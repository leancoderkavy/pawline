import unittest
from scripts.audit_search import audit_html


class SearchAuditTests(unittest.TestCase):
    def test_detects_client_only_content_wrong_canonical_and_noindex(self):
        html = '<title>Example</title><meta name="description" content="Example"><link rel="canonical" href="https://wrong.example/"><main>Loading</main>'
        result = audit_html(html, "https://www.pawlineadopt.com/", "noindex")
        self.assertEqual(len(result["errors"]), 3)

    def test_homepage_canonical_normalizes_trailing_slash(self):
        html = '<title>Pawline</title><meta name="description" content="Find pets"><link rel="canonical" href="https://www.pawlineadopt.com"><h1>Find pets</h1>'
        self.assertEqual(audit_html(html, "https://www.pawlineadopt.com/")["errors"], [])

    def test_googlebot_meta_can_block_an_otherwise_indexable_page(self):
        html = '<title>Pawline</title><meta name="description" content="Find pets"><link rel="canonical" href="https://www.pawlineadopt.com"><h1>Find pets</h1><meta name="googlebot" content="noindex">'
        self.assertIn("Sitemap page is marked noindex", audit_html(html, "https://www.pawlineadopt.com/")["errors"])
