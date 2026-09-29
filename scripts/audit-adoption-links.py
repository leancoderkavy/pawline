"""Read-only audit of a captured public Pawline pet feed."""

import concurrent.futures
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

import requests


def check(item):
    url, pets = item
    try:
        response = requests.get(url, timeout=12, allow_redirects=True, headers={"User-Agent": "PawlineLinkAudit/1.0"})
        html = response.text[:500_000]
        title = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        title = re.sub(r"\s+", " ", title.group(1)).strip()[:160] if title else ""
        normalized = re.sub(r"[^a-z0-9]", "", html.lower())
        matches = []
        for pet in pets:
            external_id = re.sub(r"[^a-z0-9]", "", str(pet.get("externalId") or "").lower())
            name = re.sub(r"[^a-z0-9]", "", str(pet.get("name") or "").lower())
            matches.append({"id": pet.get("id"), "name": pet.get("name"), "externalId": pet.get("externalId"),
                            "idInPage": bool(external_id and external_id in normalized),
                            "nameInPage": bool(name and name in normalized)})
        return {"url": url, "finalUrl": response.url, "status": response.status_code, "title": title,
                "contentType": response.headers.get("Content-Type", ""), "matches": matches}
    except requests.RequestException as error:
        return {"url": url, "error": type(error).__name__, "detail": str(error)[:160], "matches": []}


def main():
    pets = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
    urls = defaultdict(list)
    for pet in pets:
        if pet.get("sourceUrl"):
            urls[pet["sourceUrl"]].append(pet)
    scope = sys.argv[3] if len(sys.argv) > 3 else "all"
    items = list(urls.items())
    if scope == "domains":
        seen = set()
        selected = []
        for item in items:
            host = urlparse(item[0]).netloc.lower()
            if host not in seen:
                seen.add(host)
                selected.append(item)
        items = selected
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(check, items))
    Path(sys.argv[2]).write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps({"scope": scope, "checked": len(results), "http_ok": sum(r.get("status") == 200 for r in results),
                      "errors": sum("error" in r for r in results), "non_200": sum("status" in r and r["status"] != 200 for r in results)}))


if __name__ == "__main__":
    main()
