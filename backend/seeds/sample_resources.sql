-- PostgreSQL development fixtures; all organizations and links are fictional.
-- Geography comes from the existing OpenSearch index. No geography rows are inserted.
-- Supply the UUID of the account that should own these sample resources:
-- psql "$DATABASE_URL" -v created_by='YOUR-ACCOUNT-UUID' -f backend/seeds/sample_resources.sql
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO bring_them_home.community_resources
  (id, name, description, category, scope, state_code, county_name, city_name,
   website_url, source_url, created_by)
SELECT
  fixture.id::uuid,
  fixture.name,
  fixture.description,
  fixture.category,
  fixture.scope,
  fixture.state,
  fixture.county,
  fixture.city,
  'https://example.org/demo-resources/' || fixture.slug,
  'https://example.org/demo-resources/' || fixture.slug,
  :'created_by'::uuid
FROM (VALUES
  ('10000000-0000-4000-8000-000000000001',
   'Demo NYC Family Support',
   'Fictional family support resource offering keyword search test data and peer support in New York.',
   'FAMILY_SUPPORT', 'CITY', 'NY', 'New York', 'New York', 'nyc-family'),
  ('10000000-0000-4000-8000-000000000002',
   'Demo Manhattan Family Guidance',
   'Fictional countywide family guidance and practical support for relatives of missing people.',
   'FAMILY_SUPPORT', 'COUNTY', 'NY', 'New York', NULL, 'manhattan-family'),
  ('10000000-0000-4000-8000-000000000003',
   'Demo New York Family Network',
   'Fictional statewide family support network with planning and referral information.',
   'FAMILY_SUPPORT', 'STATE', 'NY', NULL, NULL, 'ny-family'),
  ('10000000-0000-4000-8000-000000000004',
   'Demo National Family Network',
   'Fictional nationwide family support and missing person referral service.',
   'FAMILY_SUPPORT', 'NATIONAL', NULL, NULL, NULL, 'national-family'),
  ('10000000-0000-4000-8000-000000000005',
   'Demo NYC Search Volunteers',
   'Fictional city search and rescue team providing volunteer search coordination.',
   'SEARCH_AND_RESCUE', 'CITY', 'NY', 'New York', 'New York', 'nyc-search'),
  ('10000000-0000-4000-8000-000000000006',
   'Demo NYC Community Awareness',
   'Fictional community group providing missing person poster and awareness guidance.',
   'COMMUNITY_AWARENESS', 'CITY', 'NY', 'New York', 'New York', 'nyc-awareness')
) AS fixture(id, name, description, category, scope, state, county, city, slug)
ON CONFLICT (id) DO NOTHING;

COMMIT;
