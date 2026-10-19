-- app_user is the role tenant-scoped transactions switch to (see src/server/db/tenant-tx.ts).
-- It only reaches tenant tables, and RLS limits it to the tenant in app.tenant_id.
GRANT USAGE ON SCHEMA public TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON
  agent_profiles, properties, property_media, contacts, deals, activities, tasks,
  funnels, funnel_submissions, availability_rules, blackouts, bookings, calendar_connections,
  automation_sequences, jobs, ad_events, conversations, messages, imports
TO app_user;
--> statement-breakpoint
-- Audit log is append-only for the application.
GRANT SELECT, INSERT ON audit_log TO app_user;
--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO app_user;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
