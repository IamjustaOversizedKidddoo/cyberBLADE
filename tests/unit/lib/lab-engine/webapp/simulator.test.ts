import { describe, expect, it } from "vitest";
import { dispatchHttpRequest } from "@/lib/lab-engine/webapp/simulator";
import type { WebAppEnv } from "@/lib/lab-engine/webapp/types";

describe("WebApp Lab Simulator", () => {
  const sqliEnv: WebAppEnv = {
    appId: "sqli_portal",
    name: "Apex Vault",
    baseUrl: "http://vault.internal",
    initialUrl: "http://vault.internal/login",
    database: {},
    config: {
      adminToken: "token_adm_xyz",
      flags: {
        flag_auth_bypass: "CYBERBLADE{sqli_bypass_ok}",
        flag_union_extract: "CYBERBLADE{union_flag_ok}",
      },
    },
  };

  it("handles SQLi login bypass and issues admin cookie", () => {
    const res = dispatchHttpRequest({
      env: sqliEnv,
      request: {
        method: "POST",
        url: "http://vault.internal/login",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "username=admin'%20OR%201=1%20--&password=foo",
      },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });

    expect(res.exchange.response.status).toBe(302);
    expect(res.exchange.response.headers.Location).toBe("/dashboard");
    expect(res.updatedCookies.vault_session).toBe("token_adm_xyz");

    // Access dashboard with the cookie
    const dashRes = dispatchHttpRequest({
      env: sqliEnv,
      request: {
        method: "GET",
        url: "http://vault.internal/dashboard",
        headers: {},
      },
      currentCookies: res.updatedCookies,
      currentStorage: {},
      currentDatabase: {},
    });

    expect(dashRes.exchange.response.status).toBe(200);
    expect(dashRes.exchange.response.body).toContain("CYBERBLADE{sqli_bypass_ok}");
  });

  it("handles SQLi UNION extraction on search endpoint", () => {
    const res = dispatchHttpRequest({
      env: sqliEnv,
      request: {
        method: "GET",
        url: "http://vault.internal/search?q='%20UNION%20SELECT%201,2,3,4%20--",
        headers: {},
      },
      currentCookies: { vault_session: "token_adm_xyz" },
      currentStorage: {},
      currentDatabase: {},
    });

    expect(res.exchange.response.status).toBe(200);
    expect(res.exchange.response.body).toContain("CYBERBLADE{union_flag_ok}");
  });

  it("handles IDOR access on user profile API", () => {
    const idorEnv: WebAppEnv = {
      appId: "idor_api",
      name: "Vanguard",
      baseUrl: "http://vanguard.lab",
      initialUrl: "http://vanguard.lab/profile",
      database: {},
      config: {
        flags: {
          flag_idor_profile: "CYBERBLADE{idor_ciso_flag}",
          flag_idor_invoice: "CYBERBLADE{idor_inv_flag}",
        },
      },
    };

    // Access unprivileged user profile (104)
    const normal = dispatchHttpRequest({
      env: idorEnv,
      request: { method: "GET", url: "http://vanguard.lab/api/user/profile?id=104", headers: {} },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });
    expect(normal.exchange.response.status).toBe(200);
    expect(normal.exchange.response.body).not.toContain("CYBERBLADE");

    // Tamper with ID parameter to 101
    const tampered = dispatchHttpRequest({
      env: idorEnv,
      request: { method: "GET", url: "http://vanguard.lab/api/user/profile?id=101", headers: {} },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });
    expect(tampered.exchange.response.status).toBe(200);
    expect(tampered.exchange.response.body).toContain("CYBERBLADE{idor_ciso_flag}");
  });

  it("handles XSS crawler admin session leak", () => {
    const xssEnv: WebAppEnv = {
      appId: "xss_board",
      name: "Guestbook",
      baseUrl: "http://board.lab",
      initialUrl: "http://board.lab/",
      database: {},
      config: {
        adminCookie: "adm_session_9942",
        flags: {
          flag_xss_cookie: "CYBERBLADE{xss_stealer_flag}",
        },
      },
    };

    // Post an XSS script comment
    const postRes = dispatchHttpRequest({
      env: xssEnv,
      request: {
        method: "POST",
        url: "http://board.lab/comments",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "author=Attacker&text=%3Cscript%3Ealert(document.cookie)%3C/script%3E",
      },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });
    expect(postRes.exchange.response.status).toBe(302);

    // Trigger admin crawler review
    const crawlRes = dispatchHttpRequest({
      env: xssEnv,
      request: { method: "GET", url: "http://board.lab/api/admin-crawler", headers: {} },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: postRes.updatedDatabase,
    });
    expect(crawlRes.exchange.response.status).toBe(200);
    expect(crawlRes.exchange.response.body).toContain("CYBERBLADE{xss_stealer_flag}");
  });
});
