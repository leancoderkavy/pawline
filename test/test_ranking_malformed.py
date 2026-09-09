import tempfile
import unittest
from pathlib import Path
from scripts.search_rankings import read_queries

class MalformedExportTests(unittest.TestCase):
    def test_rejects_duplicate_columns_and_ragged_rows(self):
        cases = [
            'Top queries,Clicks,Impressions,Position,Clicks\npets,1,2,3,1\n',
            'Top queries,Clicks,Impressions,Position\npets,1,2\n',
            'Top queries,Clicks,Impressions,Position\npets,1,2,3,extra\n',
        ]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'Queries.csv'
            for csv in cases:
                with self.subTest(csv=csv):
                    path.write_text(csv)
                    with self.assertRaises(ValueError):
                        read_queries(path)
