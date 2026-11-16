-- Public portal: one catalog across every tenant, read through a dedicated read-only role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_reader') THEN
    CREATE ROLE portal_reader NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT portal_reader TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO portal_reader;
--> statement-breakpoint
-- Only public columns. Private ones (field_confidence, needs_review, review_notes, source_import_id,
-- created_by) stay unreadable; address/lat/lng are read so the app can apply location privacy.
GRANT SELECT (
  id, tenant_id, agent_id, slug, status, featured, title, description, operation, property_type,
  price, currency, price_kind, price_note, land_area, built_area, bedrooms, bathrooms, parking,
  amenities, highlights, address, sector, city, province, country, lat, lng, location_privacy,
  published_at, created_at, updated_at
) ON properties TO portal_reader;
--> statement-breakpoint
GRANT SELECT ON property_media TO portal_reader;
--> statement-breakpoint
GRANT SELECT (
  id, tenant_id, slug, display_name, headline, bio, photo_url, phone, whatsapp, email, city,
  socials, affiliation, is_primary, created_at
) ON agent_profiles TO portal_reader;
--> statement-breakpoint
GRANT SELECT (id, slug, name) ON tenants TO portal_reader;
--> statement-breakpoint
-- Listing URLs become global (/propiedades/<slug>): rename cross-tenant duplicates, oldest keeps its slug.
UPDATE properties p SET slug = p.slug || '-' || substr(replace(p.id::text, '-', ''), 1, 6)
WHERE EXISTS (
  SELECT 1 FROM properties q WHERE q.slug = p.slug AND (q.created_at, q.id) < (p.created_at, p.id)
);
--> statement-breakpoint
DROP INDEX "properties_tenant_slug_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "properties_slug_uq" ON "properties" USING btree ("slug");--> statement-breakpoint
-- Tenant transactions cannot see other tenants' slugs (RLS); this answers "which of these are taken?"
-- without revealing anything else. Input is a slugify() root, so LIKE needs no extra escaping.
CREATE OR REPLACE FUNCTION taken_property_slugs(root text) RETURNS SETOF text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT slug FROM properties WHERE slug = root OR slug LIKE root || '-%'
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION taken_property_slugs(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION taken_property_slugs(text) TO app_user;
--> statement-breakpoint
CREATE POLICY "agent_profiles_portal_read" ON "agent_profiles" AS PERMISSIVE FOR SELECT TO "portal_reader" USING (true);--> statement-breakpoint
CREATE POLICY "properties_portal_read" ON "properties" AS PERMISSIVE FOR SELECT TO "portal_reader" USING (status in ('published', 'reserved', 'sold', 'rented'));--> statement-breakpoint
CREATE POLICY "property_media_portal_read" ON "property_media" AS PERMISSIVE FOR SELECT TO "portal_reader" USING (exists (select 1 from properties p where p.id = property_id));--> statement-breakpoint
CREATE POLICY "tenants_portal_read" ON "tenants" AS PERMISSIVE FOR SELECT TO "portal_reader" USING (true);
