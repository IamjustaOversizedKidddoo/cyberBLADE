/**
 * Structured JSON logs (one line per event) with a request id and redaction applied to every
 * field. Use instead of console.* in server code that may see learner data.
 */
import { redact, redactString } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown> & { requestId?: string };

export function formatLogLine(level: LogLevel, msg: string, fields: LogFields = {}, now = new Date()): string {
  const { requestId, ...rest } = fields;
  return JSON.stringify({ ts: now.toISOString(), level, msg: redactString(msg, 500), requestId: requestId ?? null, ...(redact(rest) as Record<string, unknown>) });
}

export const log = {
  debug: (msg: string, f?: LogFields) => process.env.NODE_ENV !== "production" && console.debug(formatLogLine("debug", msg, f)),
  info: (msg: string, f?: LogFields) => console.info(formatLogLine("info", msg, f)),
  warn: (msg: string, f?: LogFields) => console.warn(formatLogLine("warn", msg, f)),
  error: (msg: string, f?: LogFields) => console.error(formatLogLine("error", msg, f)),
};
