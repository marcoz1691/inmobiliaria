CREATE TYPE "public"."channel_provider" AS ENUM('whatsapp', 'page', 'instagram');--> statement-breakpoint
CREATE TABLE "channel_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "channel_provider" NOT NULL,
	"external_id" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "funnel_submissions" ADD COLUMN "client_ip" text;--> statement-breakpoint
ALTER TABLE "funnel_submissions" ADD COLUMN "client_ua" text;--> statement-breakpoint
ALTER TABLE "funnel_submissions" ADD COLUMN "client_captured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channel_accounts" ADD CONSTRAINT "channel_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_accounts_provider_external_uq" ON "channel_accounts" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "channel_accounts_tenant_idx" ON "channel_accounts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "funnel_submissions_client_captured_idx" ON "funnel_submissions" USING btree ("client_captured_at") WHERE "funnel_submissions"."client_captured_at" is not null;--> statement-breakpoint
CREATE POLICY "channel_accounts_tenant_isolation" ON "channel_accounts" AS PERMISSIVE FOR ALL TO "app_user" USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
-- Tenants manage their own channel accounts (RLS above); webhook routing reads them as the owner role.
GRANT SELECT, INSERT, UPDATE, DELETE ON channel_accounts TO app_user;
