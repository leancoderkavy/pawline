"""Collect bounded public Petfinder SEO metadata and candidate links, never live inventory.

Usage: python scripts/petfinder_research.py [https://www.petfinder.com/...]
Writes JSON to stdout. No database access, credentials, or automatic publication.
"""
import json
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import requests

ORIGIN = "https://www.petfinder.com"
AGENT = "PawlineResearch/1.0 (+https://www.pawlineadopt.com/how-pawline-works)"
MAX_BYTES = 2_000_000


def public_url(value):
    url = urlsplit(value)
    if (url.scheme != "https" or url.netloc != "www.petfinder.com"
            or url.username or url.password or url.query or url.fragment):
        raise ValueError("Use a public www.petfinder.com HTTPS page without query or fragment.")
    return value


class MetadataParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.description = ""
        self.canonical = ""
        self.links = set()
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "meta" and attrs.get("name", "").lower() == "description":
            self.description = attrs.get("content", "")[:400]
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical = attrs.get("href", "")
        if tag == "a" and attrs.get("href"):
            self.links.add(attrs["href"])

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title = (self.title + data)[:300]


def fetch(url, expected):
    with requests.get(public_url(url), headers={"User-Agent": AGENT}, timeout=20,
                      allow_redirects=False, stream=True) as response:
        response.raise_for_status()
        if response.status_code != 200:
            raise ValueError(f"Stopped at HTTP {response.status_code}; redirects are not followed.")
        if expected not in response.headers.get("Content-Type", "").lower():
            raise ValueError("Unexpected content type")
        body = bytearray()
        for chunk in response.iter_content(16384):
            body.extend(chunk)
            if len(body) > MAX_BYTES:
                raise ValueError("Response exceeds research size limit")
        return body.decode("utf-8", errors="replace")


def run(urls):
    if not 1 <= len(urls) <= 5:
        raise ValueError("Request between one and five pages per run")
    urls = list(dict.fromkeys(public_url(url) for url in urls))
    robots = RobotFileParser()
    robots.parse(fetch(ORIGIN + "/robots.txt", "text/plain").splitlines())
    delay = max(2, robots.crawl_delay(AGENT) or 0)
    if delay > 60:
        raise ValueError("Site crawl delay exceeds this bounded research run")
    result = {"checkedAt": datetime.now(timezone.utc).isoformat(),
              "purpose": "public metadata research; links are unverified leads, not available pets",
              "pages": []}
    for url in urls:
        if not robots.can_fetch(AGENT, url):
            result["pages"].append({"url": url, "state": "robots_disallowed"})
            continue
        time.sleep(delay)
        try:
            parser = MetadataParser()
            parser.feed(fetch(url, "text/html"))
            links = []
            for href in sorted(parser.links):
                try:
                    links.append(public_url(urljoin(url, href)))
                except ValueError:
                    pass
            result["pages"].append({"url": url, "state": "fetched", "title": parser.title,
                                    "description": parser.description, "canonical": parser.canonical,
                                    "candidateLinks": sorted(set(links))[:100]})
        except (requests.RequestException, ValueError) as error:
            result["pages"].append({"url": url, "state": "blocked", "reason": str(error)})
            break  # Do not retry access challenges or rate limits.
    return result


if __name__ == "__main__":
    try:
        print(json.dumps(run(sys.argv[1:] or [ORIGIN + "/"]), indent=2))
    except (requests.RequestException, ValueError) as error:
        print(json.dumps({"state": "blocked", "reason": str(error)}))
        sys.exit(1)
