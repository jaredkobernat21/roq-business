-- =============================================================================
-- ROQ OS — enable pgTAP for the automated RLS test suite
-- =============================================================================
-- pgTAP powers supabase/tests/*_test.sql (run via `supabase test db`, which
-- needs Docker — see docs/RLS.md for how these tests fit into the security
-- model and .github/workflows/database-tests.yml for how they run in CI).
-- Living in a migration rather than inside each test file means it's
-- guaranteed present exactly once, in the same place every other schema
-- decision in this repo lives.

create extension if not exists pgtap with schema extensions;
