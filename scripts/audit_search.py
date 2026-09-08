"""Audit sitemap landing pages in Next's build output or a deployed site.

python scripts/audit_search.py --build-dir .next/server/app
python scripts/audit_search.py --base-url https://www.pawlineadopt.com
This checks initial HTML, not Google indexing or a browser-rendered page.
"""
import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree

import requests

ORIGIN = "https://www.pawlineadopt.com"


class SearchHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals, self.descriptions, self.robots, self.schemas = [], [], [], []
        self.h1 = 0
        self.title = ""
        self.in_title = False
        self.in_schema = False
        self.schema_text = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "h1":
            self.h1 += 1
        if tag == "title":
            self.in_title = True
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href", ""))
        if tag == "meta":
            name = attrs.get("name", "").lower()
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
    nodes = [node for schema in page.schemas for node in schema.get("@graph", [schema])]
    if urlsplit(canonical).path not in ("", "/"):
        web_pages = [node for node in nodes if node.get("@type") == "WebPage" and node.get("url") == canonical]
        breadcrumbs = [node for node in nodes if node.get("@type") == "BreadcrumbList"]
        if len(web_pages) != 1 or len(breadcrumbs) != 1:
            errors.append("Expected a canonical WebPage and BreadcrumbList")
        else:
            items = breadcrumbs[0].get("itemListElement", [])
            if len(items) < 2 or [item.get("position") for item in items] != list(range(1, len(items) + 1)) or items[-1].get("item") != canonical:
                errors.append("Invalid breadcrumb hierarchy")
    return {"url": canonical, "title": page.title, "h1": page.h1, "errors": errors}


def fetch(url, content_type):
    response = requests.get(url, timeout=20, allow_redirects=False)
    if response.status_code != 200 or content_type not in response.headers.get("Content-Type", ""):
        raise ValueError(f"{url}: expected 200 {content_type}, got {response.status_code}")
    return response


def audit(build_dir=None, base_url=None):
    sitemap = fetch(base_url.rstrip("/") + "/sitemap.xml", "xml").text if base_url else Path("public/sitemap.xml").read_text()
    urls = [element.text for element in ElementTree.fromstring(sitemap).iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
    if not urls or len(set(urls)) != len(urls):
        raise ValueError("Sitemap is empty or has duplicate URLs")
    rows = []
    for url in urls:
        parsed = urlsplit(url)
        if parsed.scheme + "://" + parsed.netloc != ORIGIN or parsed.query or parsed.fragment or ".." in parsed.path.split("/"):
            raise ValueError("Sitemap must use canonical public URLs without queries or fragments")
        if base_url:
            response = fetch(base_url.rstrip("/") + parsed.path, "text/html")
            row = audit_html(response.text, url, response.headers.get("X-Robots-Tag", ""))
        else:
            route = parsed.path.strip("/") or "index"
            row = audit_html((Path(build_dir) / (route + ".html")).read_text(encoding="utf-8"), url)
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
