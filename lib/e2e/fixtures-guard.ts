/** Guard for the test-only fixture endpoint (app/api/e2e): explicit env flag and a loopback host. */
export function e2eFixturesAllowed(env: Record<string, string | undefined>, host: string | null): boolean {
  const hostname = (host ?? "").replace(/:\d+$/, "").toLowerCase();
  return env.CYBERBLADE_ALLOW_LOCAL_E2E === "true" && ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}
