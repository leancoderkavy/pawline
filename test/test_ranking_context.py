import unittest
from scripts.search_rankings import summarize, validate_comparison


class RankingContextTests(unittest.TestCase):
    def setUp(self):
        self.current = {"site": "https://www.pawlineadopt.com/", "searchType": "web", "filters": {}, "startDate": "2026-08-08", "endDate": "2026-08-14"}
        self.previous = {**self.current, "startDate": "2026-08-01", "endDate": "2026-08-07"}

    def test_changed_filters_or_unequal_ranges_are_rejected(self):
        for delta in [{"filters": {"device": "MOBILE"}}, {"site": "other"}, {"endDate": "2026-08-13"}, {"startDate": "2026-08-01", "endDate": "2026-08-07"}]:
            with self.assertRaises(ValueError):
                validate_comparison({**self.current, **delta}, self.previous)

    def test_absent_queries_remain_unknown_and_unverified_deltas_are_suppressed(self):
        prior = {"dogs": {"query": "dogs", "clicks": 3, "impressions": 50, "averagePosition": 8, "ctr": .06}}
        report = summarize({}, prior, self.current, self.previous)
        self.assertEqual(report["queries"][0]["observation"], "previous_only")
        self.assertIsNone(report["queries"][0]["clicks"])
        self.assertIsNone(report["queries"][0]["positionImprovement"])
        unsafe = summarize(prior, prior)
        self.assertEqual(unsafe["comparison"], "context_required")
        self.assertIsNone(unsafe["queries"][0]["clickChange"])

    def test_empty_report_does_not_claim_an_average_rank(self):
        report = summarize({})
        self.assertEqual(report["queries"], [])
        self.assertEqual(report["observedCurrentTotals"]["impressions"], 0)
