ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenants_self_read" ON "tenants" AS PERMISSIVE FOR SELECT TO "app_user" USING (id = nullif(current_setting('app.tenant_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT ON tenants TO app_user;
