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

class InternalLinkTests(unittest.TestCase):
    def test_article_local_and_cross_page_fragments(self):
        from scripts.audit_search import audit_links
        pages = {'/guides': ('<h1 id="topics">Guides</h1>', '')}
        html = '<a href="#missing">Broken</a><a href="/guides#topics">Valid</a><a href="/guides#other-missing">Broken</a>'
        errors = audit_links(html, 'https://www.pawlineadopt.com/guides', pages.__getitem__)
        self.assertEqual(len(errors), 2)
        self.assertTrue(all('missing anchor' in error for error in errors))

    def test_missing_destination_and_noncanonical_origin(self):
        from scripts.audit_search import audit_links
        def missing(path):
            raise FileNotFoundError(path)
        errors = audit_links('<a href="/missing">Missing</a><a href="http://www.pawlineadopt.com/guides">HTTP</a><a href="https://pawlineadopt.com/guides">Apex</a>', 'https://www.pawlineadopt.com/guides', missing)
        self.assertEqual(len(errors), 3)

    def test_external_and_unsafe_paths_are_never_fetched(self):
        from scripts.audit_search import audit_links
        def unexpected(path):
            self.fail(f'Unexpected fetch: {path}')
        errors = audit_links('<a href="https://example.com/">External</a><a href="mailto:help@example.com">Email</a><a href="/api/pets">API</a><a href="/%2e%2e/secret">Traversal</a>', 'https://www.pawlineadopt.com/guides', unexpected)
        self.assertEqual(len(errors), 2)

    def test_root_application_hash_and_encoded_article_id(self):
        from scripts.audit_search import audit_links
        pages = {'/': ('<h1>Map</h1>', ''), '/guides': ('<h2 id="adoption tips">Tips</h2>', '')}
        html = '<a href="/#match">Quiz</a><a href="/guides#adoption%20tips">Tips</a>'
        self.assertEqual(audit_links(html, 'https://www.pawlineadopt.com/guides', pages.__getitem__), [])

class SocialPreviewTests(unittest.TestCase):
    def test_detects_missing_and_wrong_social_metadata(self):
        from scripts.audit_search import audit_social
        errors = audit_social('<meta property="og:url" content="https://www.pawlineadopt.com/wrong"><meta property="og:image" content="http://example.com/image.png">', 'https://www.pawlineadopt.com/guides')
        self.assertIn('Social URL does not match canonical', errors)
        self.assertIn('Social image must use HTTPS: og:image', errors)
        self.assertIn('Missing or duplicate social metadata: twitter:card', errors)

class RobotsPolicyTests(unittest.TestCase):
    def test_specific_search_bot_block_is_detected(self):
        from scripts.audit_search import audit_robots, ORIGIN
        policy = 'User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /guides\n\nSitemap: ' + ORIGIN + '/sitemap.xml'
        errors = audit_robots(policy, [ORIGIN + '/guides'])
        self.assertEqual(len(errors), 1)
        self.assertIn('OAI-SearchBot', errors[0])

    def test_requires_canonical_sitemap(self):
        from scripts.audit_search import audit_robots
        self.assertIn('Robots policy is missing canonical sitemap', audit_robots('User-agent: *\nAllow: /', []))

class StructuredDataShapeTests(unittest.TestCase):
    def test_accepts_array_and_graph_forms(self):
        from scripts.audit_search import schema_nodes
        node = {'@type':'WebPage'}
        self.assertEqual(schema_nodes([node, {'@graph':[node]}]), [node,node])

    def test_rejects_scalar_and_malformed_graph(self):
        from scripts.audit_search import schema_nodes
        for value in (None, 'bad', 42, {'@graph':{}}, [None]):
            with self.subTest(value=value), self.assertRaises(ValueError):
                schema_nodes(value)
