-- Official public-domain sources verified against their live Socrata schemas.
-- They remain disabled until an operator reviews attribution and runs a staged import.

INSERT INTO sources (
  id, name, kind, url, country_code, attribution, terms_url, enabled, parser_config
) VALUES
(
  '4eec9ba1-1f85-4e6f-a21b-772f84bb0021',
  'Montgomery County Animal Services adoptable pets',
  'json',
  'https://data.montgomerycountymd.gov/resource/e54u-qx42.json?$limit=5000',
  'US',
  'Montgomery County, Maryland',
  'https://data.montgomerycountymd.gov/Public-Safety/Adoptable-Pets/e54u-qx42',
  false,
  '{
    "mapping": {
      "external_id": "animalid",
      "name": "petname",
      "species": "animaltype",
      "breed": "breed",
      "age": "petage",
      "sex": "sex",
      "size": "petsize",
      "image_url": "url.url"
    },
    "constants": {
      "city": "Derwood",
      "country": "United States",
      "postal_code": "20855",
      "shelter": "Montgomery County Animal Services and Adoption Center",
      "source_url": "https://www.montgomerycountymd.gov/animalservices/adoption/index.html"
    },
    "value_maps": {
      "sex": {"M": "Male", "F": "Female", "N": "Neutered Male", "S": "Spayed Female", "U": "Unknown"}
    }
  }'::jsonb
),
(
  'd7fbc275-cf13-40c1-976e-31df071b25c8',
  'Regional Animal Services of King County adoptable pets',
  'json',
  'https://data.kingcounty.gov/resource/yaai-7frk.json?$limit=5000&$where=upper(record_type)%20=%20%27ADOPTABLE%27',
  'US',
  'Regional Animal Services of King County',
  'https://data.kingcounty.gov/Pets/Lost-found-adoptable-pets/yaai-7frk',
  false,
  '{
    "mapping": {
      "external_id": "animal_id",
      "name": "animal_name",
      "species": "animal_type",
      "breed": "animal_breed",
      "age": "age",
      "sex": "animal_gender",
      "description": "memo",
      "city": "city",
      "postal_code": "zip",
      "latitude": "obfuscated_latitude",
      "longitude": "obfuscated_longitude",
      "image_url": "image.url",
      "source_url": "link.url"
    },
    "constants": {
      "country": "United States",
      "shelter": "Regional Animal Services of King County"
    },
    "strip_html_fields": ["description"]
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  url = EXCLUDED.url,
  country_code = EXCLUDED.country_code,
  attribution = EXCLUDED.attribution,
  terms_url = EXCLUDED.terms_url,
  parser_config = EXCLUDED.parser_config,
  updated_at = now();
