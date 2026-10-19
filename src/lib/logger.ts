type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, msg: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...data });
  if (level === "error" || level === "warn") console.error(line);
  else if (process.env.NODE_ENV !== "test") console.log(line);
}

/** Structured JSON logger. Never pass secrets or full personal data. */
export const log = {
  debug: (msg: string, data?: Record<string, unknown>) => write("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => write("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => write("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => write("error", msg, data),
};

export function errorInfo(err: unknown) {
  return err instanceof Error ? { error: err.message, name: err.name } : { error: String(err) };
}
