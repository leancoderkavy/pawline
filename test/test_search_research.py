import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.petfinder_research import MetadataParser, public_url, run
from scripts.search_rankings import read_queries, summarize


class SearchResearchTests(unittest.TestCase):
    def test_petfinder_rejects_external_and_authenticated_urls(self):
        for url in ["http://www.petfinder.com/", "https://evil.test/", "https://www.petfinder.com.evil.test/",
                    "https://user@www.petfinder.com/", "https://www.petfinder.com/?token=secret"]:
            with self.assertRaises(ValueError):
                public_url(url)

    def test_robots_denial_does_not_fetch_page(self):
        with patch("scripts.petfinder_research.fetch", return_value="User-agent: *\nDisallow: /") as fetch:
            result = run(["https://www.petfinder.com/"])
            self.assertEqual(result["pages"][0]["state"], "robots_disallowed")
            self.assertEqual(fetch.call_count, 1)

    def test_parser_extracts_metadata_without_article_or_animal_records(self):
        parser = MetadataParser()
        parser.feed('<title>Dogs &amp; cats</title><meta name="description" content="Adoption search"><a href="/dog/example/">Pet</a><p>Long article</p>')
        self.assertEqual(parser.title, "Dogs & cats")
        self.assertEqual(parser.links, {"/dog/example/"})
        self.assertEqual(parser.description, "Adoption search")

    def test_csv_metrics_and_comparison_preserve_missing_data(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "Queries.csv"
            path.write_text('Top queries,Clicks,Impressions,CTR,Position\n"dogs, nearby",10,200,5%,8.5\nnew,0,0,0%,0\n', encoding="utf-8-sig")
            current = read_queries(path)
        result = summarize(current, {"dogs, nearby": {"averagePosition": 10}})
        self.assertEqual(result["queries"][0]["positionImprovement"], 1.5)
        self.assertEqual(result["queries"][0]["ctr"], .05)
        self.assertIsNone(result["queries"][1]["averagePosition"])
        self.assertIsNone(result["queries"][1]["positionImprovement"])

    def test_invalid_metric_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "Queries.csv"
            path.write_text('Top queries,Clicks,Impressions,Position\ndogs,1,20,NaN\n')
            with self.assertRaises(ValueError):
                read_queries(path)
