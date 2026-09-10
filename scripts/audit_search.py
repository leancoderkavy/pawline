"""Audit sitemap landing pages in Next's build output or a deployed site.

python scripts/audit_search.py --build-dir .next/server/app
python scripts/audit_search.py --base-url https://www.pawlineadopt.com
This checks initial HTML, not Google indexing or a browser-rendered page.
"""
import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urljoin, unquote
from xml.etree import ElementTree

import requests
from urllib.robotparser import RobotFileParser

ORIGIN = "https://www.pawlineadopt.com"


class SearchHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals, self.descriptions, self.robots, self.schemas = [], [], [], []
        self.links, self.ids = [], set()
        self.social = {}
        self.h1 = 0
        self.title = ""
        self.in_title = False
        self.in_schema = False
        self.schema_text = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "h1":
            self.h1 += 1
        if tag == "title":
            self.in_title = True
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href", ""))
        if tag == "meta":
            name = attrs.get("name", "").lower()
            key = attrs.get("property", name)
            if key.startswith(("og:", "twitter:")):
                self.social.setdefault(key, []).append(attrs.get("content", ""))
            if name == "description":
                self.descriptions.append(attrs.get("content", ""))
            if name in ("robots", "googlebot"):
                self.robots.append(attrs.get("content", "").lower())
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.in_schema, self.schema_text = True, ""

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script" and self.in_schema:
            self.schemas.append(json.loads(self.schema_text))
            self.in_schema = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_schema:
            self.schema_text += data


def schema_nodes(value):
    """Accept JSON-LD objects, arrays and graphs; reject malformed roots cleanly."""
    if isinstance(value, list):
        return [node for item in value for node in schema_nodes(item)]
    if not isinstance(value, dict):
        raise ValueError("JSON-LD must contain objects, not scalar values")
    if "@graph" in value:
        if not isinstance(value["@graph"], list):
            raise ValueError("JSON-LD @graph must be an array")
        return schema_nodes(value["@graph"])
    return [value]


def audit_html(html, canonical, robots_header=""):
    page = SearchHTML()
    page.feed(html)
    errors = []
    if [url.rstrip("/") for url in page.canonicals] != [canonical.rstrip("/")]:
        errors.append("Missing, duplicate, or incorrect canonical")
    if page.h1 != 1:
        errors.append("Expected exactly one initial-HTML h1")
    if not page.title.strip():
        errors.append("Missing title")
    if len(page.descriptions) != 1 or not page.descriptions[0].strip():
        errors.append("Missing or duplicate description")
    if any("noindex" in value or "none" in [token.strip() for token in value.split(",")] for value in [*page.robots, robots_header.lower()]):
        errors.append("Sitemap page is marked noindex")
    nodes = [node for schema in page.schemas for node in schema_nodes(schema)]
    if urlsplit(canonical).path not in ("", "/"):
        web_pages = [node for node in nodes if node.get("@type") == "WebPage" and node.get("url") == canonical]
        breadcrumbs = [node for node in nodes if node.get("@type") == "BreadcrumbList"]
        if len(web_pages) != 1 or len(breadcrumbs) != 1:
            errors.append("Expected a canonical WebPage and BreadcrumbList")
        else:
            items = breadcrumbs[0].get("itemListElement", [])
            if not isinstance(items, list) or not all(isinstance(item, dict) for item in items) or len(items) < 2 or [item.get("position") for item in items] != list(range(1, len(items) + 1)) or items[-1].get("item") != canonical:
                errors.append("Invalid breadcrumb hierarchy")
            reference = web_pages[0].get("breadcrumb")
            if not isinstance(reference, dict) or reference.get("@id") != breadcrumbs[0].get("@id") or not breadcrumbs[0].get("@id"):
                errors.append("WebPage breadcrumb reference is missing or disconnected")
    return {"url": canonical, "title": page.title, "h1": page.h1, "errors": errors}


def audit_social(html, canonical):
    page = SearchHTML()
    page.feed(html)
    errors = []
    for key in ("og:title", "og:description", "og:url", "og:image", "twitter:card", "twitter:title", "twitter:description", "twitter:image"):
        values = page.social.get(key, [])
        if len(values) != 1 or not values[0].strip():
            errors.append(f"Missing or duplicate social metadata: {key}")
    if page.social.get("og:url", [""])[0].rstrip("/") != canonical.rstrip("/"):
        errors.append("Social URL does not match canonical")
    for key in ("og:image", "twitter:image"):
        for image in page.social.get(key, []):
            if urlsplit(image).scheme != "https":
                errors.append(f"Social image must use HTTPS: {key}")
    return errors


def fetch(url, content_type):
    response = requests.get(url, timeout=20, allow_redirects=False)
    if response.status_code != 200 or content_type not in response.headers.get("Content-Type", ""):
        raise ValueError(f"{url}: expected 200 {content_type}, got {response.status_code}")
    return response


def audit_links(html, canonical, load_page):
    """Check public HTML destinations once via a cached loader; never follow external links.

    Homepage hashes are application navigation and need browser tests. Article
    hashes must resolve to a real element, including relative/cross-page links.
    """
    page = SearchHTML()
    page.feed(html)
    errors = []
    checked = set()
    for href in page.links:
        target = urlsplit(urljoin(canonical, href))
        if target.hostname not in ("www.pawlineadopt.com", "pawlineadopt.com"):
            continue
        if target.scheme != "https" or target.netloc != "www.pawlineadopt.com":
            errors.append(f"Internal link does not use canonical origin: {href}")
            continue
        path = unquote(target.path).rstrip("/") or "/"
        if ".." in path.split("/") or "\\" in path or path.startswith("/api/") or path == "/api":
            errors.append(f"Internal link is not a public page: {href}")
            continue
        key = (path, target.fragment)
        if key in checked:
            continue
        checked.add(key)
        try:
            destination = SearchHTML()
            destination.feed(load_page(path)[0])
            if path != "/" and target.fragment and unquote(target.fragment) not in destination.ids:
                errors.append(f"Internal link has missing anchor: {href}")
        except (ValueError, OSError, requests.RequestException) as error:
            errors.append(f"Broken internal link {href}: {error}")
    return errors


def audit_robots(text, urls):
    policy = RobotFileParser()
    policy.parse(text.splitlines())
    errors = []
    if ORIGIN + "/sitemap.xml" not in (policy.site_maps() or []):
        errors.append("Robots policy is missing canonical sitemap")
    for agent in ("Googlebot", "bingbot", "OAI-SearchBot", "PerplexityBot"):
        for url in urls:
            if not policy.can_fetch(agent, url):
                errors.append(f"Robots policy blocks {agent}: {url}")
    return errors


def audit(build_dir=None, base_url=None):
    sitemap = fetch(base_url.rstrip("/") + "/sitemap.xml", "xml").text if base_url else Path("public/sitemap.xml").read_text()
    urls = [element.text for element in ElementTree.fromstring(sitemap).iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
    if not urls or len(set(urls)) != len(urls):
        raise ValueError("Sitemap is empty or has duplicate URLs")
    robots = fetch(base_url.rstrip("/") + "/robots.txt", "text/plain").text if base_url else Path("public/robots.txt").read_text()
    robots_errors = audit_robots(robots, urls)
    if robots_errors:
        raise ValueError("; ".join(robots_errors))
    cache = {}

    def load_page(path):
        if path not in cache:
            if len(cache) >= 32:
                raise ValueError("Public page audit exceeds 32 destinations")
            # Reserve failed destinations too, to keep live requests bounded.
            cache[path] = ValueError("Page could not be loaded")
            try:
                if base_url:
                    response = fetch(base_url.rstrip("/") + path, "text/html")
                    cache[path] = (response.text, response.headers.get("X-Robots-Tag", ""))
                else:
                    route = path.strip("/") or "index"
                    cache[path] = ((Path(build_dir) / (route + ".html")).read_text(encoding="utf-8"), "")
            except (ValueError, OSError, requests.RequestException) as error:
                cache[path] = error
        if isinstance(cache[path], Exception):
            raise cache[path]
        return cache[path]

    rows = []
    for url in urls:
        parsed = urlsplit(url)
        if parsed.scheme + "://" + parsed.netloc != ORIGIN or parsed.query or parsed.fragment or ".." in unquote(parsed.path).split("/") or "\\" in unquote(parsed.path):
            raise ValueError("Sitemap must use canonical public URLs without queries or fragments")
        html, header = load_page(parsed.path.rstrip("/") or "/")
        row = audit_html(html, url, header)
        row["errors"].extend(audit_social(html, url))
        row["errors"].extend(audit_links(html, url, load_page))
        if any(prior["title"] == row["title"] for prior in rows):
            row["errors"].append("Duplicate page title")
        rows.append(row)
    return rows


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--build-dir")
    mode.add_argument("--base-url")
    args = parser.parse_args()
    try:
        rows = audit(args.build_dir, args.base_url)
        print(json.dumps({"passed": not any(row["errors"] for row in rows), "pages": rows}, indent=2))
        raise SystemExit(1 if any(row["errors"] for row in rows) else 0)
    except (ValueError, OSError, ElementTree.ParseError, requests.RequestException) as error:
        parser.exit(1, f"Search audit failed: {error}\n")
