"""Summarize an English GSC Performance Queries CSV export without inventing ranks.

Usage: python scripts/search_rankings.py Queries.csv [previous-Queries.csv]
Keep exports and reports private; query text can contain personal information.
"""
import argparse
import csv
import json
import math
import sys
from pathlib import Path
from datetime import date


def read_queries(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if not {"Top queries", "Clicks", "Impressions", "Position"}.issubset(reader.fieldnames or []):
            raise ValueError("Use the English GSC Performance Queries.csv export")
        if len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise ValueError("Duplicate CSV columns")
        result = {}
        for row in reader:
            if None in row or any(row.get(key) is None for key in ("Top queries", "Clicks", "Impressions", "Position")):
                raise ValueError("Malformed CSV row: expected all query metrics")
            query = row["Top queries"].strip()
            if not query:
                raise ValueError("Query must not be blank")
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


def validate_comparison(current, previous):
    required = {"site", "searchType", "startDate", "endDate", "filters"}
    for context in (current, previous):
        if not isinstance(context, dict) or not required.issubset(context):
            raise ValueError("Comparison requires site, searchType, startDate, endDate, and filters for both exports")
        if not context["site"] or not context["searchType"] or not isinstance(context["filters"], dict):
            raise ValueError("Invalid export context")
    if any(current[key] != previous[key] for key in ("site", "searchType", "filters")):
        raise ValueError("Compare the same property, search type, and filters")
    start, end = date.fromisoformat(current["startDate"]), date.fromisoformat(current["endDate"])
    old_start, old_end = date.fromisoformat(previous["startDate"]), date.fromisoformat(previous["endDate"])
    if end < start or old_end < old_start or (end - start) != (old_end - old_start) or old_end >= start:
        raise ValueError("Use equal, non-overlapping date ranges with the previous period first")


def summarize(current, previous=None, current_context=None, previous_context=None):
    comparable = previous is not None and current_context is not None and previous_context is not None
    if comparable:
        validate_comparison(current_context, previous_context)
    rows = []
    for query in set(current) | set(previous or {}):
        metrics = current.get(query)
        prior = (previous or {}).get(query)
        old = prior.get("averagePosition") if prior else None
        position = metrics.get("averagePosition") if metrics else None
        rows.append({**(metrics or {"query": query, "clicks": None, "impressions": None, "ctr": None, "averagePosition": None}),
                     "previousAveragePosition": old,
                     "observation": "both" if metrics and prior else "current_only" if metrics else "previous_only",
                     "positionImprovement": round(old - position, 2) if comparable and old is not None and position is not None else None,
                     "clickChange": metrics["clicks"] - prior["clicks"] if comparable and metrics and prior else None,
                     "opportunity": "not_observed_current" if not metrics else "review_title_and_intent" if metrics["impressions"] >= 100 and position is not None and 4 <= position <= 20 else "monitor"})
    return {"source": "Google Search Console query export",
            "comparison": "validated" if comparable else "context_required" if previous is not None else "single_period",
            "coverage": {
                "currentQueries": len(current),
                "previousQueries": len(previous) if previous is not None else None,
                "sharedQueries": len(set(current) & set(previous)) if previous is not None else None,
                "currentOnlyQueries": len(set(current) - set(previous)) if previous is not None else None,
                "previousOnlyQueries": len(set(previous) - set(current)) if previous is not None else None,
                "positionDeltaQueries": sum(row["positionImprovement"] is not None for row in rows),
            },
            "currentContext": current_context, "previousContext": previous_context,
            "interpretation": "Average position across impressions, not a fixed rank. Missing queries are unknown, not zero or unranked. Query exports omit some data; observed totals are not property totals. Deltas require matching filters and equal, non-overlapping periods.",
            "observedCurrentTotals": {"queries": len(current), "clicks": sum(row["clicks"] for row in current.values()), "impressions": sum(row["impressions"] for row in current.values())},
            "queries": sorted(rows, key=lambda row: (-(row["impressions"] if row["impressions"] is not None else -1), row["query"]))}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("current")
    parser.add_argument("previous", nargs="?")
    parser.add_argument("--current-context", help="JSON recording site, searchType, startDate, endDate, filters")
    parser.add_argument("--previous-context", help="JSON recording the previous export's context")
    args = parser.parse_args()
    if args.previous and not (args.current_context and args.previous_context):
        parser.error("Comparisons require --current-context and --previous-context JSON files")
    try:
        context = lambda path: json.loads(Path(path).read_text(encoding="utf-8-sig")) if path else None
        result = summarize(read_queries(args.current), read_queries(args.previous) if args.previous else None,
                           context(args.current_context), context(args.previous_context))
        print(json.dumps(result, indent=2, allow_nan=False))
    except (ValueError, OSError, TypeError) as error:
        parser.error(str(error))
