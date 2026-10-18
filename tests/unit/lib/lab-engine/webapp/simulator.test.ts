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

  it("handles pentest_sqli_union with ORDER BY and UNION SELECT", () => {
    const env: WebAppEnv = {
      appId: "pentest_sqli_union",
      name: "Apex Store",
      baseUrl: "http://shop.apex.internal",
      initialUrl: "http://shop.apex.internal/products",
      database: {},
      config: {
        flags: {
          flag_db: "PENTEST{union_test_flag}",
        },
      },
    };

    const res = dispatchHttpRequest({
      env,
      request: { method: "GET", url: "http://shop.apex.internal/products?category=test'%20UNION%20SELECT%201,2,3--", headers: {} },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });
    expect(res.exchange.response.status).toBe(200);
    expect(res.exchange.response.body).toContain("DATABASE INJECTION SUCCESSFUL");
    expect(res.exchange.response.body).toContain("PENTEST{union_test_flag}");
  });

  it("handles pentest_sqli_blind differential boolean responses", () => {
    const env: WebAppEnv = {
      appId: "pentest_sqli_blind",
      name: "Apex Verify",
      baseUrl: "http://verify.apex.internal",
      initialUrl: "http://verify.apex.internal/verify",
      database: {},
      config: {
        flags: {
          flag_blind: "PENTEST{blind_test_flag}",
        },
      },
    };

    const trueRes = dispatchHttpRequest({
      env,
      request: { method: "GET", url: "http://verify.apex.internal/verify?id=101%20and%201=1", headers: {} },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });
    expect(trueRes.exchange.response.status).toBe(200);
    expect(trueRes.exchange.response.body).toContain("STATUS: VERIFIED");
    expect(trueRes.exchange.response.body).toContain("PENTEST{blind_test_flag}");

    const falseRes = dispatchHttpRequest({
      env,
      request: { method: "GET", url: "http://verify.apex.internal/verify?id=101%20and%201=2", headers: {} },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });
    expect(falseRes.exchange.response.status).toBe(200);
    expect(falseRes.exchange.response.body).toContain("STATUS: NOT FOUND");
  });

  it("handles pentest_cmdi command execution", () => {
    const env: WebAppEnv = {
      appId: "pentest_cmdi",
      name: "Ping Utility",
      baseUrl: "http://net.apex.internal",
      initialUrl: "http://net.apex.internal/ping",
      database: {},
      config: {
        flags: {
          flag_cmdi: "PENTEST{cmdi_test_flag}",
        },
      },
    };

    const whoamiRes = dispatchHttpRequest({
      env,
      request: {
        method: "POST",
        url: "http://net.apex.internal/tools/ping",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "ip=127.0.0.1;whoami",
      },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });
    expect(whoamiRes.exchange.response.status).toBe(200);
    expect(whoamiRes.exchange.response.body).toContain("apex-operator");

    const flagRes = dispatchHttpRequest({
      env,
      request: {
        method: "POST",
        url: "http://net.apex.internal/tools/ping",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "ip=127.0.0.1;cat /etc/apex_release",
      },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });
    expect(flagRes.exchange.response.status).toBe(200);
    expect(flagRes.exchange.response.body).toContain("PENTEST{cmdi_test_flag}");
  });

  it("handles pentest_xss_stored comment submission and render", () => {
    const env: WebAppEnv = {
      appId: "pentest_xss_stored",
      name: "Feedback Board",
      baseUrl: "http://board.apex.internal",
      initialUrl: "http://board.apex.internal/feedback",
      database: {},
      config: {
        flags: {
          flag_xss: "PENTEST{xss_test_flag}",
        },
      },
    };

    const postRes = dispatchHttpRequest({
      env,
      request: {
        method: "POST",
        url: "http://board.apex.internal/feedback",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "author=Attacker&message=%3Cscript%3Ealert(1)%3C/script%3E",
      },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });
    expect(postRes.exchange.response.status).toBe(200);
    expect(postRes.exchange.response.body).toContain("PENTEST{xss_test_flag}");
  });

  it("handles pentest_file_upload shell execution", () => {
    const env: WebAppEnv = {
      appId: "pentest_file_upload",
      name: "Portal",
      baseUrl: "http://portal.apex.internal",
      initialUrl: "http://portal.apex.internal/upload",
      database: {},
      config: {
        flags: {
          flag_upload: "PENTEST{upload_test_flag}",
        },
      },
    };

    const uploadRes = dispatchHttpRequest({
      env,
      request: {
        method: "POST",
        url: "http://portal.apex.internal/upload",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "filename=avatar.php&content_type=image/png",
      },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });
    expect(uploadRes.exchange.response.status).toBe(200);
    expect(uploadRes.exchange.response.body).toContain("/uploads/avatar.php");

    const execRes = dispatchHttpRequest({
      env,
      request: { method: "GET", url: "http://portal.apex.internal/uploads/avatar.php", headers: {} },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: uploadRes.updatedDatabase,
    });
    expect(execRes.exchange.response.status).toBe(200);
    expect(execRes.exchange.response.body).toContain("PENTEST{upload_test_flag}");
  });

  it("handles pentest_idor access control bypass", () => {
    const env: WebAppEnv = {
      appId: "pentest_idor",
      name: "Records",
      baseUrl: "http://records.apex.internal",
      initialUrl: "http://records.apex.internal/patient?id=204",
      database: {},
      config: {
        flags: {
          flag_idor: "PENTEST{idor_test_flag}",
        },
      },
    };

    const vipRes = dispatchHttpRequest({
      env,
      request: { method: "GET", url: "http://records.apex.internal/patient?id=201", headers: {} },
      currentCookies: {},
      currentStorage: {},
      currentDatabase: {},
    });
    expect(vipRes.exchange.response.status).toBe(200);
    expect(vipRes.exchange.response.body).toContain("PENTEST{idor_test_flag}");
    expect(vipRes.exchange.response.body).toContain("Senator Evelyn Vance");
  });
});

