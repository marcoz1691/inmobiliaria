import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgRole,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Multi-tenant model. Every business table carries `tenant_id` and is protected twice:
 *  1. repositories always filter by the tenant resolved on the server, and
 *  2. Postgres RLS: tenant work runs as role `app_user` with `app.tenant_id` set per transaction
 *     (see `withTenant` in ./tenant-tx.ts). Auth and system tables are not reachable by `app_user`.
 */
export const appUser = pgRole("app_user").existing();

const tenantIsolation = (table: string) =>
  pgPolicy(`${table}_tenant_isolation`, {
    as: "permissive",
    for: "all",
    to: appUser,
    using: sql`tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`,
    withCheck: sql`tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid`,
  });

const id = () => uuid("id").primaryKey().defaultRandom();
const tenantId = () => uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ───────────────────────────── Identity (Better Auth) ───────────────────────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────────────────────────── Tenants & agents ───────────────────────────── */

export const tenants = pgTable("tenants", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Guayaquil"),
  currency: text("currency").notNull().default("USD"),
  locale: text("locale").notNull().default("es-EC"),
  /** Brand tokens editable from the panel: { accent, logoUrl, tagline }. */
  branding: jsonb("branding").$type<TenantBranding>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, () => [
  // app_user may read (not change) only its own tenant row.
  pgPolicy("tenants_self_read", {
    as: "permissive",
    for: "select",
    to: appUser,
    using: sql`id = nullif(current_setting('app.tenant_id', true), '')::uuid`,
  }),
]);

export type TenantBranding = { accent?: string; logoUrl?: string; tagline?: string };

/** Host names served by a tenant. Resolution happens on the server only (src/server/tenant.ts). */
export const tenantDomains = pgTable("tenant_domains", {
  domain: text("domain").primaryKey(),
  tenantId: tenantId(),
  createdAt: createdAt(),
});

export const memberRole = pgEnum("member_role", ["owner", "admin", "agent"]);

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    tenantId: tenantId(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("agent"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_tenant_user_uq").on(t.tenantId, t.userId), index("memberships_user_idx").on(t.userId)],
);

export type SocialLinks = Partial<Record<"instagram" | "facebook" | "tiktok" | "linkedin" | "youtube" | "x" | "website", string>>;

export const agentProfiles = pgTable(
  "agent_profiles",
  {
    id: id(),
    tenantId: tenantId(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    headline: text("headline"),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    city: text("city"),
    socials: jsonb("socials").$type<SocialLinks>().notNull().default({}),
    /** Brokerage affiliation shown only when the agent explicitly fills it in. */
    affiliation: text("affiliation"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("agent_profiles_tenant_slug_uq").on(t.tenantId, t.slug), tenantIsolation("agent_profiles")],
);

/* ───────────────────────────── Properties & media ───────────────────────────── */

export const propertyStatus = pgEnum("property_status", ["draft", "published", "paused", "reserved", "sold", "rented", "archived"]);
export const operationType = pgEnum("operation_type", ["sale", "rent"]);
export const propertyType = pgEnum("property_type", [
  "house",
  "apartment",
  "land",
  "office",
  "commercial",
  "warehouse",
  "building",
  "other",
]);
export const priceKind = pgEnum("price_kind", ["sale", "rent", "appraisal"]);
export const locationPrivacy = pgEnum("location_privacy", ["exact", "approximate", "hidden"]);

export type FieldConfidence = Record<string, "high" | "low" | "missing">;

export const properties = pgTable(
  "properties",
  {
    id: id(),
    tenantId: tenantId(),
    agentId: uuid("agent_id").references(() => agentProfiles.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    status: propertyStatus("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    title: text("title").notNull().default(""),
    description: text("description"),
    operation: operationType("operation"),
    propertyType: propertyType("property_type"),
    price: numeric("price", { precision: 14, scale: 2, mode: "number" }),
    currency: text("currency").notNull().default("USD"),
    priceKind: priceKind("price_kind").notNull().default("sale"),
    priceNote: text("price_note"),
    landArea: numeric("land_area", { precision: 12, scale: 2, mode: "number" }),
    builtArea: numeric("built_area", { precision: 12, scale: 2, mode: "number" }),
    bedrooms: integer("bedrooms"),
    bathrooms: numeric("bathrooms", { precision: 3, scale: 1, mode: "number" }),
    parking: integer("parking"),
    amenities: text("amenities").array().notNull().default(sql`'{}'::text[]`),
    highlights: text("highlights").array().notNull().default(sql`'{}'::text[]`),
    /** Street address. Never rendered publicly unless location_privacy = 'exact'. */
    address: text("address"),
    sector: text("sector"),
    city: text("city"),
    province: text("province"),
    country: text("country").notNull().default("EC"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    locationPrivacy: locationPrivacy("location_privacy").notNull().default("approximate"),
    fieldConfidence: jsonb("field_confidence").$type<FieldConfidence>().notNull().default({}),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewNotes: text("review_notes"),
    sourceImportId: uuid("source_import_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("properties_tenant_slug_uq").on(t.tenantId, t.slug),
    index("properties_tenant_status_idx").on(t.tenantId, t.status, t.publishedAt),
    index("properties_tenant_filters_idx").on(t.tenantId, t.operation, t.propertyType, t.city),
    index("properties_tenant_price_idx").on(t.tenantId, t.price),
    tenantIsolation("properties"),
  ],
);

export type MediaVariant = { width: number; height: number; key: string; format: "webp" | "avif" | "jpeg" };

export const propertyMedia = pgTable(
  "property_media",
  {
    id: id(),
    tenantId: tenantId(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    blurDataUrl: text("blur_data_url"),
    variants: jsonb("variants").$type<MediaVariant[]>().notNull().default([]),
    alt: text("alt"),
    position: integer("position").notNull().default(0),
    isCover: boolean("is_cover").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("property_media_property_idx").on(t.tenantId, t.propertyId, t.position),
    uniqueIndex("property_media_one_cover_uq").on(t.propertyId).where(sql`${t.isCover}`),
    tenantIsolation("property_media"),
  ],
);

/* ───────────────────────────── CRM ───────────────────────────── */

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    source: text("source").notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    consentText: text("consent_text"),
    optedOutAt: timestamp("opted_out_at", { withTimezone: true }),
    utm: jsonb("utm").$type<Record<string, string>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("contacts_tenant_email_idx").on(t.tenantId, t.email),
    index("contacts_tenant_phone_idx").on(t.tenantId, t.phone),
    tenantIsolation("contacts"),
  ],
);

export const dealStage = pgEnum("deal_stage", ["new", "qualified", "booked", "attended", "offer", "won", "lost", "no_show", "nurture"]);

export const deals = pgTable(
  "deals",
  {
    id: id(),
    tenantId: tenantId(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    funnelId: uuid("funnel_id").references(() => funnels.id, { onDelete: "set null" }),
    agentId: uuid("agent_id").references(() => agentProfiles.id, { onDelete: "set null" }),
    stage: dealStage("stage").notNull().default("new"),
    score: integer("score"),
    source: text("source").notNull(),
    message: text("message"),
    lostReason: text("lost_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("deals_tenant_stage_idx").on(t.tenantId, t.stage, t.createdAt),
    index("deals_tenant_property_idx").on(t.tenantId, t.propertyId),
    index("deals_contact_idx").on(t.contactId),
    tenantIsolation("deals"),
  ],
);

/** Unified timeline: form submissions, notes, stage changes, bookings, messages, emails. */
export const activities = pgTable(
  "activities",
  {
    id: id(),
    tenantId: tenantId(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    body: text("body"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("activities_contact_idx").on(t.tenantId, t.contactId, t.createdAt), tenantIsolation("activities")],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    tenantId: tenantId(),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    assigneeUserId: text("assignee_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_tenant_due_idx").on(t.tenantId, t.doneAt, t.dueAt), tenantIsolation("tasks")],
);

/* ───────────────────────────── Funnels & scheduling ───────────────────────────── */

export const funnelVertical = pgEnum("funnel_vertical", ["real_estate", "services"]);
export const funnelStatus = pgEnum("funnel_status", ["draft", "active", "paused"]);
export const meetingKind = pgEnum("meeting_kind", ["video", "phone", "in_person"]);

export type FunnelQuestion = {
  id: string;
  label: string;
  help?: string;
  type: "single" | "multi" | "text" | "number";
  required: boolean;
  options?: { value: string; label: string; score: number; disqualify?: boolean }[];
};

export const funnels = pgTable(
  "funnels",
  {
    id: id(),
    tenantId: tenantId(),
    agentId: uuid("agent_id").references(() => agentProfiles.id, { onDelete: "set null" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    vertical: funnelVertical("vertical").notNull(),
    status: funnelStatus("status").notNull().default("draft"),
    headline: text("headline").notNull(),
    subheadline: text("subheadline"),
    questions: jsonb("questions").$type<FunnelQuestion[]>().notNull().default([]),
    threshold: integer("threshold").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    bufferMinutes: integer("buffer_minutes").notNull().default(15),
    minNoticeHours: integer("min_notice_hours").notNull().default(12),
    maxDaysAhead: integer("max_days_ahead").notNull().default(21),
    meetingKind: meetingKind("meeting_kind").notNull().default("video"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("funnels_tenant_slug_uq").on(t.tenantId, t.slug), tenantIsolation("funnels")],
);

export const funnelSubmissions = pgTable(
  "funnel_submissions",
  {
    id: id(),
    tenantId: tenantId(),
    funnelId: uuid("funnel_id")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    answers: jsonb("answers").$type<Record<string, string | string[] | number>>().notNull(),
    score: integer("score").notNull(),
    qualified: boolean("qualified").notNull(),
    disqualifiedReason: text("disqualified_reason"),
    utm: jsonb("utm").$type<Record<string, string>>().notNull().default({}),
    fbclid: text("fbclid"),
    fbc: text("fbc"),
    fbp: text("fbp"),
    clientEventId: text("client_event_id"),
    /**
     * Visitor IP and user agent for the Conversions API (personal data). Captured only while CAPI is
     * connected, cleared once the event is sent or after 7 days (src/modules/funnels/client-data.ts).
     */
    clientIp: text("client_ip"),
    clientUa: text("client_ua"),
    clientCapturedAt: timestamp("client_captured_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("funnel_submissions_funnel_idx").on(t.tenantId, t.funnelId, t.createdAt),
    index("funnel_submissions_client_captured_idx").on(t.clientCapturedAt).where(sql`${t.clientCapturedAt} is not null`),
    tenantIsolation("funnel_submissions"),
  ],
);

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: id(),
    tenantId: tenantId(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agentProfiles.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [index("availability_agent_idx").on(t.tenantId, t.agentId), tenantIsolation("availability_rules")],
);

export const blackouts = pgTable(
  "blackouts",
  {
    id: id(),
    tenantId: tenantId(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agentProfiles.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
  },
  (t) => [index("blackouts_agent_idx").on(t.tenantId, t.agentId, t.startsAt), tenantIsolation("blackouts")],
);

export const bookingStatus = pgEnum("booking_status", ["confirmed", "cancelled", "completed", "no_show"]);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    tenantId: tenantId(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agentProfiles.id, { onDelete: "cascade" }),
    funnelId: uuid("funnel_id").references(() => funnels.id, { onDelete: "set null" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: bookingStatus("status").notNull().default("confirmed"),
    meetingKind: meetingKind("meeting_kind").notNull(),
    meetingUrl: text("meeting_url"),
    googleEventId: text("google_event_id"),
    manageTokenHash: text("manage_token_hash").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("bookings_agent_slot_uq").on(t.agentId, t.startsAt).where(sql`${t.status} = 'confirmed'`),
    index("bookings_tenant_starts_idx").on(t.tenantId, t.startsAt),
    tenantIsolation("bookings"),
  ],
);

export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id: id(),
    tenantId: tenantId(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agentProfiles.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("google"),
    accountEmail: text("account_email"),
    calendarId: text("calendar_id").notNull().default("primary"),
    /** AES-256-GCM ciphertext (src/lib/crypto.ts). */
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("calendar_connections_agent_uq").on(t.agentId, t.provider), tenantIsolation("calendar_connections")],
);

/* ───────────────────────────── Automations & jobs ───────────────────────────── */

export const sequenceTrigger = pgEnum("sequence_trigger", ["booking_created", "lead_created", "lead_unqualified", "no_show"]);

export type SequenceStep = {
  id: string;
  channel: "email" | "whatsapp";
  /** Minutes relative to the anchor. Negative = before (only for anchor "booking_start"). */
  offsetMinutes: number;
  anchor: "trigger" | "booking_start";
  template: string;
};

export const automationSequences = pgTable(
  "automation_sequences",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    trigger: sequenceTrigger("trigger").notNull(),
    funnelId: uuid("funnel_id").references(() => funnels.id, { onDelete: "cascade" }),
    steps: jsonb("steps").$type<SequenceStep[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("sequences_tenant_trigger_idx").on(t.tenantId, t.trigger), tenantIsolation("automation_sequences")],
);

export const jobStatus = pgEnum("job_status", ["pending", "running", "done", "failed", "blocked", "cancelled"]);

/** Outbox + scheduler. `blocked` = channel not connected; never reported as sent. */
export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    tenantId: tenantId(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    status: jobStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastError: text("last_error"),
    idempotencyKey: text("idempotency_key").notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("jobs_tenant_idempotency_uq").on(t.tenantId, t.idempotencyKey),
    index("jobs_due_idx").on(t.status, t.runAt),
    tenantIsolation("jobs"),
  ],
);

export const adEvents = pgTable(
  "ad_events",
  {
    id: id(),
    tenantId: tenantId(),
    eventName: text("event_name").notNull(),
    eventId: text("event_id").notNull(),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    response: jsonb("response"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ad_events_dedupe_uq").on(t.tenantId, t.eventName, t.eventId), tenantIsolation("ad_events")],
);

/* ───────────────────────────── Conversations ───────────────────────────── */

export const channelProvider = pgEnum("channel_provider", ["whatsapp", "page", "instagram"]);

/**
 * Meta accounts (WhatsApp phone_number_id, Facebook page id, Instagram account id) owned by a
 * tenant. Webhooks are routed with this table; an id belongs to at most one tenant.
 */
export const channelAccounts = pgTable(
  "channel_accounts",
  {
    id: id(),
    tenantId: tenantId(),
    provider: channelProvider("provider").notNull(),
    externalId: text("external_id").notNull(),
    label: text("label"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("channel_accounts_provider_external_uq").on(t.provider, t.externalId),
    index("channel_accounts_tenant_idx").on(t.tenantId),
    tenantIsolation("channel_accounts"),
  ],
);

export const channel = pgEnum("channel", ["web", "whatsapp", "instagram", "messenger"]);

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    tenantId: tenantId(),
    channel: channel("channel").notNull(),
    externalThreadId: text("external_thread_id"),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    status: text("status").notNull().default("open"),
    handoffRequestedAt: timestamp("handoff_requested_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("conversations_thread_uq").on(t.tenantId, t.channel, t.externalThreadId),
    index("conversations_tenant_updated_idx").on(t.tenantId, t.updatedAt),
    tenantIsolation("conversations"),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    tenantId: tenantId(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    direction: text("direction").$type<"in" | "out">().notNull(),
    role: text("role").$type<"user" | "assistant" | "agent" | "system">().notNull(),
    body: text("body").notNull(),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId, t.createdAt),
    uniqueIndex("messages_external_uq").on(t.tenantId, t.externalId),
    tenantIsolation("messages"),
  ],
);

/* ───────────────────────────── Imports ───────────────────────────── */

export const importStatus = pgEnum("import_status", ["pending", "parsed", "failed", "converted"]);

export const imports = pgTable(
  "imports",
  {
    id: id(),
    tenantId: tenantId(),
    fileName: text("file_name").notNull(),
    fileSha256: text("file_sha256").notNull(),
    storageKey: text("storage_key"),
    pageCount: integer("page_count"),
    extractedText: text("extracted_text"),
    /** ExtractedListing[] (src/modules/imports/types.ts); a brochure may contain several listings. */
    extracted: jsonb("extracted").$type<unknown>(),
    method: text("method").$type<"parser" | "ai">(),
    status: importStatus("status").notNull().default("pending"),
    error: text("error"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("imports_tenant_sha_uq").on(t.tenantId, t.fileSha256), tenantIsolation("imports")],
);

/* ───────────────────────────── Audit & system ───────────────────────────── */

/** Append-only (enforced by trigger in drizzle/0002_grants_and_triggers.sql). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: tenantId(),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_entity_idx").on(t.tenantId, t.entityType, t.entityId, t.createdAt), tenantIsolation("audit_log")],
);

/** System tables: not tenant-scoped, not granted to app_user. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("received"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("webhook_events_provider_event_uq").on(t.provider, t.eventId)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
