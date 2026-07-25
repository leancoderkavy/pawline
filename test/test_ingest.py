import unittest

from scripts.ingest import canonical_species, clean_text, nested, normalize


class IngestNormalizationTests(unittest.TestCase):
    def test_nested_supports_socrata_url_objects(self):
        self.assertEqual(nested({"image": {"url": "https://example.test/pet"}}, "image.url"),
                         "https://example.test/pet")

    def test_normalize_applies_constants_maps_and_html_cleanup(self):
        source = {
            "id": "source-id",
            "parser_config": {
                "mapping": {
                    "external_id": "animalid",
                    "name": "petname",
                    "species": "animaltype",
                    "sex": "sex",
                    "description": "memo",
                    "image_url": "url.url",
                },
                "constants": {"city": "Derwood", "country": "United States"},
                "value_maps": {"sex": {"N": "Neutered Male"}},
                "strip_html_fields": ["description"],
            },
        }
        pet = normalize({
            "animalid": "A123",
            "petname": "Henry",
            "animaltype": "DOG",
            "sex": "N",
            "memo": "Friendly</p>  dog &amp; companion",
            "url": {"url": "https://example.test/A123"},
        }, source)
        self.assertEqual(pet["species"], "Dog")
        self.assertEqual(pet["sex"], "Neutered Male")
        self.assertEqual(pet["city"], "Derwood")
        self.assertEqual(pet["description"], "Friendly dog & companion")
        self.assertEqual(pet["image_url"], "https://example.test/A123")

    def test_unsupported_species_is_rejected(self):
        source = {"id": "source-id", "parser_config": {
            "mapping": {"name": "name", "species": "species"}
        }}
        self.assertIsNone(normalize({"name": "Tweety", "species": "Bird"}, source))

    def test_text_cleanup_handles_empty_values(self):
        self.assertIsNone(clean_text("  "))
        self.assertEqual(canonical_species("feline"), "Cat")


if __name__ == "__main__":
    unittest.main()
