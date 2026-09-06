"""Summarize an English GSC Performance Queries CSV export without inventing ranks.

Usage: python scripts/search_rankings.py Queries.csv [previous-Queries.csv]
Keep exports and reports private; query text can contain personal information.
"""
import csv
import json
import math
import sys
from pathlib import Path


def read_queries(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if not {"Top queries", "Clicks", "Impressions", "Position"}.issubset(reader.fieldnames or []):
            raise ValueError("Use the English GSC Performance Queries.csv export")
        result = {}
        for row in reader:
            query = row["Top queries"].strip()
            clicks = int(row["Clicks"].replace(",", ""))
            impressions = int(row["Impressions"].replace(",", ""))
            position = float(row["Position"]) if impressions else None
            if clicks < 0 or impressions < clicks or (position is not None and (not math.isfinite(position) or position < 1)):
                raise ValueError("Invalid GSC metrics")
            if query in result:
                raise ValueError("Duplicate query: export queries without additional dimensions")
            result[query] = {"query": query, "clicks": clicks, "impressions": impressions,
                             "ctr": clicks / impressions if impressions else None,
                             "averagePosition": position}
        return result


def summarize(current, previous=None):
    rows = []
    for query, metrics in current.items():
        old = (previous or {}).get(query, {}).get("averagePosition")
        position = metrics["averagePosition"]
        rows.append({**metrics,
                     "positionImprovement": round(old - position, 2) if old is not None and position is not None else None,
                     "opportunity": "review_title_and_intent" if metrics["impressions"] >= 100 and position is not None and 4 <= position <= 20 else "monitor"})
    return {"source": "Google Search Console query export",
            "interpretation": "Average position across impressions, not a fixed rank. Missing queries are unknown, not zero or unranked. Compare equal date ranges and identical filters.",
            "queries": sorted(rows, key=lambda row: (-row["impressions"], row["query"]))}


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit("Usage: python scripts/search_rankings.py Queries.csv [previous-Queries.csv]")
    print(json.dumps(summarize(read_queries(sys.argv[1]), read_queries(sys.argv[2]) if len(sys.argv) == 3 else None), indent=2, allow_nan=False))
