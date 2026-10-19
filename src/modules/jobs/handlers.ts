import type { JobHandler } from "./runner";

/**
 * Job type → handler. Integrations register here (messages, Conversions API, calendar sync,
 * agent notifications). Unregistered types are parked as `blocked`, never reported as done.
 */
export const jobHandlers: Record<string, JobHandler> = {};
