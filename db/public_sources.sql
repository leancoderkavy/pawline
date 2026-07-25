-- Official public sources verified against their live Socrata schemas and terms pages.
-- The scheduled importer refreshes these four times daily.

CREATE UNIQUE INDEX IF NOT EXISTS adoption_events_source_external_unique
  ON adoption_events (source_id, external_id)
  WHERE source_id IS NOT NULL AND external_id IS NOT NULL;

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
  true,
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
  true,
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
),
(
  '9321672f-badc-4a23-93a1-53c5d25e9844',
  'Pasadena Humane dog adoption events',
  'json',
  'https://pasadenahumane.org/wp-json/tribe/events/v1/events?per_page=50&start_date=now&search=adoption',
  'US',
  'Pasadena Humane',
  'https://pasadenahumane.org/phs-events/',
  true,
  '{
    "entity": "event",
    "records_path": "events",
    "mapping": {
      "external_id": "id",
      "title": "title",
      "description": "description",
      "starts_at": "utc_start_date",
      "ends_at": "utc_end_date",
      "source_url": "url"
    },
    "constants": {
      "country": "United States",
      "organizer": "Pasadena Humane"
    },
    "strip_html_fields": ["description"],
    "required_terms": ["adopt"],
    "dog_terms": ["dog", "pup", "mutts", "all animals", "all adult"],
    "excluded_terms": ["food bank", "closed", "training", "workshop", "class"]
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  url = EXCLUDED.url,
  country_code = EXCLUDED.country_code,
  attribution = EXCLUDED.attribution,
  terms_url = EXCLUDED.terms_url,
  enabled = EXCLUDED.enabled,
  parser_config = EXCLUDED.parser_config,
  updated_at = now();
