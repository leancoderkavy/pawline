import unittest
from unittest.mock import patch
from scripts.discover import SITES, discover_site


class DiscoveryTests(unittest.TestCase):
    def test_more_than_twenty_distinct_sites(self):
        self.assertEqual(len({url for _, url in SITES}), 25)

    @patch('scripts.discover.fetch')
    def test_extracts_and_deduplicates_links(self, fetch):
        fetch.side_effect = [('https://example.org/robots.txt', ''),
                             ('https://example.org/', '<a href="/adopt">Pets</a><a href="/adopt">Pets</a><link href="/pets.json" type="application/json"><a href="javascript:adopt()">bad</a>')]
        result = discover_site(('Example', 'https://example.org/'))
        self.assertEqual(result['status'], 'checked')
        self.assertEqual(result['adoption_links'], ['https://example.org/adopt'])
        self.assertEqual(result['feed_links'], ['https://example.org/pets.json'])

    @patch('scripts.discover.fetch', return_value=('https://example.org/robots.txt', 'User-agent: *\nDisallow: /'))
    def test_robots_denial_skips_page(self, fetch):
        self.assertEqual(discover_site(('Example', 'https://example.org/'))['status'], 'blocked_by_robots')
        self.assertEqual(fetch.call_count, 1)

    @patch('scripts.discover.fetch', side_effect=ValueError('unreachable'))
    def test_error_is_reported(self, fetch):
        self.assertEqual(discover_site(('Example', 'https://example.org/'))['status'], 'error')
