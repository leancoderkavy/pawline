import unittest
from scripts.search_rankings import summarize

class ComparisonCoverageTests(unittest.TestCase):
    def test_distinguishes_missing_queries_from_comparable_positions(self):
        def row(q): return {'query':q, 'clicks':1, 'impressions':10, 'averagePosition':5, 'ctr':0.1}
        result = summarize({'shared':row('shared'),'new':row('new')}, {'shared':row('shared'),'old':row('old')})
        self.assertEqual(result['coverage'], {'currentQueries':2,'previousQueries':2,'sharedQueries':1,'currentOnlyQueries':1,'previousOnlyQueries':1,'positionDeltaQueries':0})
        self.assertIsNone(summarize({})['coverage']['previousQueries'])
