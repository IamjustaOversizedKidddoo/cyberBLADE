export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

const escaped = E2E_BASE_URL.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Matches a URL on the test server, optionally with a path suffix pattern. */
export const onSite = (path = "") => new RegExp(`^${escaped}${path}`);
