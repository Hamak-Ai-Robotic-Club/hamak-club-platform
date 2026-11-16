-- Supabase exposes the public schema through its Data API (PostgREST).
-- The browser never talks to the database directly in this system: every
-- request goes through the Express API, which connects with the database
-- owner role (that role bypasses RLS). Enabling RLS without any policy blocks
-- the anon/authenticated Data API roles from reading or writing these tables.
ALTER TABLE "components"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "requests"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "request_items"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deliveries"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_items"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "returns"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "return_items"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hackathon_summaries" ENABLE ROW LEVEL SECURITY;
