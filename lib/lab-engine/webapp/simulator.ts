import type { HttpExchange, HttpRequest, HttpResponse, WebAppEnv } from "./types";

export type DispatchResult = {
  exchange: HttpExchange;
  updatedCookies: Record<string, string>;
  updatedStorage: Record<string, string>;
  updatedDatabase: Record<string, Array<Record<string, unknown>>>;
};

/**
 * Parses query params from path and query string.
 */
export function parseUrl(rawUrl: string, baseUrl: string) {
  try {
    const full = rawUrl.startsWith("http") ? rawUrl : `${baseUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
    const parsed = new URL(full);
    const query: Record<string, string> = {};
    parsed.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    return {
      url: parsed.toString(),
      path: parsed.pathname,
      query,
    };
  } catch {
    const [pathPart, queryPart] = rawUrl.split("?");
    const query: Record<string, string> = {};
    if (queryPart) {
      for (const pair of queryPart.split("&")) {
        const eqIdx = pair.indexOf("=");
        if (eqIdx !== -1) {
          const k = pair.slice(0, eqIdx);
          const v = pair.slice(eqIdx + 1);
          query[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
        }
      }
    }
    return {
      url: `${baseUrl}${pathPart.startsWith("/") ? "" : "/"}${pathPart}`,
      path: pathPart.startsWith("/") ? pathPart : `/${pathPart}`,
      query,
    };
  }
}

/**
 * Parses form urlencoded body into key-value map.
 */
export function parseFormBody(body?: string): Record<string, string> {
  if (!body) return {};
  const result: Record<string, string> = {};
  for (const pair of body.split("&")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx !== -1) {
      const rawK = pair.slice(0, eqIdx);
      const rawV = pair.slice(eqIdx + 1);
      const k = decodeURIComponent(rawK.replace(/\+/g, " "));
      const v = decodeURIComponent(rawV.replace(/\+/g, " "));
      result[k] = v;
    }
  }
  return result;
}

/**
 * Dispatches an HTTP request against the simulated WebApp environment.
 */
export function dispatchHttpRequest(input: {
  env: WebAppEnv;
  request: Omit<HttpRequest, "id" | "timestamp" | "path" | "query">;
  currentCookies: Record<string, string>;
  currentStorage: Record<string, string>;
  currentDatabase: Record<string, Array<Record<string, unknown>>>;
}): DispatchResult {
  const { env, request: reqInput, currentCookies, currentStorage, currentDatabase } = input;
  const parsed = parseUrl(reqInput.url, env.baseUrl);

  const req: HttpRequest = {
    ...reqInput,
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    path: parsed.path,
    query: parsed.query,
  };

  const cookies = { ...currentCookies };
  const storage = { ...currentStorage };
  const database = { ...currentDatabase };

  let res: HttpResponse;

  switch (env.appId) {
    case "sqli_portal":
      res = handleSqliPortal(req, env, cookies);
      break;
    case "xss_board":
      res = handleXssBoard(req, env, cookies, database);
      break;
    case "idor_api":
      res = handleIdorApi(req, env);
      break;
    case "r2_capstone":
      res = handleR2Capstone(req, env, cookies);
      break;
    case "pentest_web_portal":
      res = handlePentestWebPortal(req, env, cookies);
      break;
    case "pentest_capstone_portal":
      res = handlePentestCapstonePortal(req, env, cookies);
      break;
    default:
      res = {
        status: 404,
        statusText: "Not Found",
        headers: { "Content-Type": "text/html" },
        body: `<h1>404 Not Found</h1><p>Route ${req.path} not mapped in ${env.appId}</p>`,
      };
  }

  // Handle Set-Cookie headers in response to update active cookie jar
  if (res.headers["Set-Cookie"]) {
    const parts = res.headers["Set-Cookie"].split(";")[0].split("=");
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      cookies[name] = val;
    }
  }

  return {
    exchange: { request: req, response: res },
    updatedCookies: cookies,
    updatedStorage: storage,
    updatedDatabase: database,
  };
}

// -----------------------------------------------------------------------------
// 1. SQL Injection Portal Simulation (Auth Bypass & Union Extraction)
// -----------------------------------------------------------------------------
function handleSqliPortal(
  req: HttpRequest,
  env: WebAppEnv,
  cookies: Record<string, string>,
): HttpResponse {
  const flags = env.config.flags as Record<string, string>;

  // Root redirect
  if (req.path === "/" || req.path === "") {
    return {
      status: 302,
      statusText: "Found",
      headers: { Location: "/login" },
      body: `<a href="/login">Redirecting to login</a>`,
    };
  }

  // GET /login
  if (req.method === "GET" && req.path === "/login") {
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/html" },
      body: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Apex Vault · Employee Portal</title>
  <style>
    body { font-family: monospace; background: #0a0e14; color: #d0d7de; padding: 2rem; }
    .card { background: #161b22; border: 1px solid #30363d; padding: 2rem; max-width: 420px; margin: 2rem auto; }
    h2 { color: #58a6ff; margin-top: 0; }
    input, button { width: 100%; box-sizing: border-box; padding: 0.6rem; margin: 0.5rem 0; background: #0d1117; color: #fff; border: 1px solid #30363d; }
    button { background: #238636; cursor: pointer; font-weight: bold; }
    .muted { color: #8b949e; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="card">
    <h2>APEX VAULT // AUTHENTICATION</h2>
    <p class="muted">Notice: Legacy SQL engine active (v4.2). Restricted to internal staff.</p>
    <form method="POST" action="/login">
      <label>Operator Username:</label>
      <input type="text" name="username" placeholder="e.g. jdoe" required />
      <label>Passcode:</label>
      <input type="password" name="password" placeholder="••••••••" required />
      <button type="submit">AUTHENTICATE &gt;&gt;</button>
    </form>
  </div>
</body>
</html>`,
    };
  }

  // POST /login
  if (req.method === "POST" && req.path === "/login") {
    const form = parseFormBody(req.body);
    const u = form.username || "";
    const p = form.password || "";

    // Simulated SQL Vulnerability:
    // query = `SELECT * FROM users WHERE username = '${u}' AND password = '${p}'`
    const isSqliBypass =
      u.includes("' OR 1=1") ||
      u.includes("' or 1=1") ||
      u.includes("' OR '1'='1") ||
      u.includes("' or '1'='1") ||
      u.includes("' OR ''='") ||
      u.includes("admin' --") ||
      u.includes("admin' #") ||
      p.includes("' OR 1=1") ||
      p.includes("' or 1=1");

    if (isSqliBypass) {
      const adminToken = env.config.adminToken as string;
      return {
        status: 302,
        statusText: "Found",
        headers: {
          "Set-Cookie": `vault_session=${adminToken}; Path=/; HttpOnly`,
          Location: "/dashboard",
        },
        body: `<p>Authentication bypassed! Redirecting to <a href="/dashboard">dashboard</a>...</p>`,
      };
    }

    return {
      status: 401,
      statusText: "Unauthorized",
      headers: { "Content-Type": "text/html" },
      body: `
<!DOCTYPE html>
<html>
<head><style>body { background: #0a0e14; color: #f85149; font-family: monospace; padding: 2rem; }</style></head>
<body>
  <h3>[ERROR 401] INVALID CREDENTIALS</h3>
  <p>SQL query returned 0 rows for user '${u}'.</p>
  <p><a href="/login" style="color: #58a6ff">&lt;&lt; Return to Login</a></p>
</body>
</html>`,
    };
  }

  // GET /dashboard
  if (req.method === "GET" && req.path === "/dashboard") {
    const session = cookies.vault_session;
    const adminToken = env.config.adminToken as string;

    if (!session || session !== adminToken) {
      return {
        status: 403,
        statusText: "Forbidden",
        headers: { "Content-Type": "text/html" },
        body: `<h3>403 FORBIDDEN</h3><p>Session missing or insufficient privileges. <a href="/login">Login here</a>.</p>`,
      };
    }

    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/html" },
      body: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Apex Vault · Admin Console</title>
  <style>
    body { font-family: monospace; background: #0a0e14; color: #d0d7de; padding: 2rem; }
    .banner { border-left: 3px solid #238636; background: #161b22; padding: 1rem 1.5rem; margin-bottom: 2rem; }
    .flag { background: #0d1117; border: 1px dashed #f0883e; padding: 0.8rem; color: #f0883e; font-size: 1.1rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #30363d; padding: 0.6rem; text-align: left; }
    th { background: #161b22; color: #58a6ff; }
  </style>
</head>
<body>
  <div class="banner">
    <h2>APEX VAULT // PRIVILEGED SESSION GRANTED</h2>
    <p>Identity: <strong>admin@apex.internal</strong> · Clearance: <strong>Tier-0</strong></p>
    <div class="flag">OBJ-1 FLAG: ${flags.flag_auth_bypass}</div>
  </div>

  <h3>SECURITY ARCHIVE SEARCH</h3>
  <p>Search confidential assets via the catalog query:</p>
  <form method="GET" action="/search">
    <input style="background:#0d1117; color:#fff; border:1px solid #30363d; padding:0.5rem; width:280px;" type="text" name="q" placeholder="Enter asset keyword..." value="" />
    <button style="background:#238636; color:#fff; border:none; padding:0.5rem 1rem; cursor:pointer;" type="submit">SEARCH</button>
  </form>
</body>
</html>`,
    };
  }

  // GET /search (Catalog search vulnerable to UNION SQLi)
  if (req.method === "GET" && req.path === "/search") {
    const q = req.query.q || "";

    // Simulated UNION attack check:
    // query = `SELECT id, name, category, price FROM assets WHERE name LIKE '%${q}%'`
    let results: Array<{ id: string | number; name: string; category: string; price: string | number }> = [
      { id: 1, name: "Core Firewall Appliance", category: "Network", price: "$4,500" },
      { id: 2, name: "Encrypted HSM Keycard", category: "Hardware", price: "$1,200" },
      { id: 3, name: "Fiber Optic T-Tap", category: "Monitoring", price: "$850" },
    ];

    const isUnionAttack =
      q.toLowerCase().includes("union") &&
      q.toLowerCase().includes("select");

    if (isUnionAttack) {
      results = [
        ...results,
        {
          id: 999,
          name: `RECOVERED: ${flags.flag_union_extract}`,
          category: "EXTRACTED_SECRET",
          price: "CLASSIFIED",
        },
      ];
    } else if (q.trim()) {
      results = results.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
    }

    const rowsHtml = results
      .map(
        (r) =>
          `<tr><td>${r.id}</td><td style="color:${String(r.name).includes("CYBERBLADE") ? "#f0883e; font-weight:bold;" : "#d0d7de"}">${r.name}</td><td>${r.category}</td><td>${r.price}</td></tr>`,
      )
      .join("");

    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/html" },
      body: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Apex Vault · Asset Catalog</title>
  <style>
    body { font-family: monospace; background: #0a0e14; color: #d0d7de; padding: 2rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #30363d; padding: 0.6rem; text-align: left; }
    th { background: #161b22; color: #58a6ff; }
    a { color: #58a6ff; }
  </style>
</head>
<body>
  <h2>ASSET REPERTORY // SEARCH</h2>
  <p><a href="/dashboard">&lt;&lt; Back to Dashboard</a></p>
  <form method="GET" action="/search">
    <input style="background:#0d1117; color:#fff; border:1px solid #30363d; padding:0.5rem; width:360px;" type="text" name="q" value="${escapeHtml(q)}" placeholder="Search query..." />
    <button style="background:#238636; color:#fff; border:none; padding:0.5rem 1rem; cursor:pointer;" type="submit">QUERY DB</button>
  </form>

  <p style="color:#8b949e; font-size:0.85rem;">SQL: SELECT id, name, category, price FROM assets WHERE name LIKE '%${q}%'</p>

  <table>
    <thead><tr><th>ID</th><th>ASSET NAME</th><th>CATEGORY</th><th>VALUATION</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`,
    };
  }

  return {
    status: 404,
    statusText: "Not Found",
    headers: { "Content-Type": "text/html" },
    body: `<h3>404 Not Found</h3><p>Route ${req.path} not mapped.</p>`,
  };
}

// -----------------------------------------------------------------------------
// 2. Cross-Site Scripting (XSS) Guestbook Simulation
// -----------------------------------------------------------------------------
function handleXssBoard(
  req: HttpRequest,
  env: WebAppEnv,
  cookies: Record<string, string>,
  db: Record<string, Array<Record<string, unknown>>>,
): HttpResponse {
  const flags = env.config.flags as Record<string, string>;
  const adminCookie = env.config.adminCookie as string;
  const comments = (db.comments ??= [
    { author: "Security Officer", text: "Welcome to the Operations Guestbook. Keep remarks professional." },
    { author: "System Watcher", text: "Notice: Content Security Policy is currently in monitoring mode." },
  ]);

  if (req.method === "POST" && req.path === "/comments") {
    const form = parseFormBody(req.body);
    const author = form.author?.trim() || "Anonymous";
    const text = form.text || "";

    if (text) {
      comments.push({ author, text });
    }

    return {
      status: 302,
      statusText: "Found",
      headers: { Location: "/board" },
      body: `<a href="/board">Redirecting to board...</a>`,
    };
  }

  // GET /board or /
  if (req.path === "/" || req.path === "/board") {
    const commentsHtml = comments
      .map(
        (c) => `
        <div style="border: 1px solid #30363d; background: #161b22; padding: 1rem; margin-bottom: 1rem;">
          <div style="color: #58a6ff; font-weight: bold; margin-bottom: 0.4rem;">${escapeHtml(String(c.author))}</div>
          <div class="comment-body">${String(c.text)}</div>
        </div>
      `,
      )
      .join("");

    return {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "text/html",
        "Set-Cookie": cookies.session ? "" : `user_session=guest_942; Path=/`,
      },
      body: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sentinel Operations // Guestbook</title>
  <style>
    body { font-family: monospace; background: #0a0e14; color: #d0d7de; padding: 2rem; }
    .card { background: #161b22; border: 1px solid #30363d; padding: 1.5rem; max-width: 600px; margin-bottom: 2rem; }
    input, textarea, button { width: 100%; box-sizing: border-box; padding: 0.6rem; margin: 0.5rem 0; background: #0d1117; color: #fff; border: 1px solid #30363d; }
    button { background: #238636; cursor: pointer; font-weight: bold; }
  </style>
</head>
<body>
  <h2>SENTINEL OPERATIONS // INCIDENT FEED</h2>
  <p style="color:#8b949e">Unsanitized community telemetry feed. Simulates Stored XSS.</p>

  <div class="card">
    <h3>POST NEW ENTRY</h3>
    <form method="POST" action="/comments">
      <input type="text" name="author" placeholder="Your callsign / name" required />
      <textarea rows="3" name="text" placeholder="Enter message payload..." required></textarea>
      <button type="submit">PUBLISH TO FEED &gt;&gt;</button>
    </form>
    <div style="margin-top: 1rem; border-top: 1px dashed #30363d; pt: 1rem;">
      <p style="color: #8b949e; font-size: 0.85rem;">Simulate Admin Reviewer Bot inspecting this feed:</p>
      <a href="/api/admin-crawler" style="color: #f0883e; text-decoration: underline;">[TRIGGER ADMIN REVIEW BOT VISIT]</a>
    </div>
  </div>

  <h3>PUBLISHED TRANSMISSIONS</h3>
  <div id="comments-container">
    ${commentsHtml}
  </div>
</body>
</html>`,
    };
  }

  // GET /api/admin-crawler (Simulates an admin reviewing the feed and triggering script execution)
  if (req.path === "/api/admin-crawler") {
    // Check if any comment contains XSS payload
    const hasXss = comments.some((c) => {
      const s = String(c.text).toLowerCase();
      return (
        s.includes("<script") ||
        s.includes("<img") ||
        s.includes("<svg") ||
        s.includes("onerror=") ||
        s.includes("onload=") ||
        s.includes("alert(") ||
        s.includes("document.cookie")
      );
    });

    if (hasXss) {
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          {
            status: "EXPLOIT_SUCCESSFUL",
            crawler_event: "Admin bot visited /board with active session cookie.",
            leaked_cookie: adminCookie,
            flag: flags.flag_xss_cookie,
            message: "Stored XSS payload executed in administrator browser session context!",
          },
          null,
          2,
        ),
      };
    }

    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        {
          status: "CRAWLER_CLEAN",
          crawler_event: "Admin bot reviewed /board. No active script payloads executed.",
          hint: "Submit a comment containing a functional XSS payload (e.g. <script>... or <img onerror=...>) to hijack the admin session.",
        },
        null,
        2,
      ),
    };
  }

  return {
    status: 404,
    statusText: "Not Found",
    headers: { "Content-Type": "text/html" },
    body: `<h3>404 Not Found</h3>`,
  };
}

// -----------------------------------------------------------------------------
// 3. IDOR / BOLA Profile API Simulation
// -----------------------------------------------------------------------------
function handleIdorApi(
  req: HttpRequest,
  env: WebAppEnv,
): HttpResponse {
  const flags = env.config.flags as Record<string, string>;

  // Root redirect
  if (req.path === "/" || req.path === "") {
    return {
      status: 302,
      statusText: "Found",
      headers: { Location: "/profile" },
      body: `<a href="/profile">Redirecting...</a>`,
    };
  }

  // GET /profile (renders current user's dossier: id=104)
  if (req.method === "GET" && req.path === "/profile") {
    return {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "text/html",
        "Set-Cookie": "account_session=usr_104_token; Path=/",
      },
      body: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vanguard Defense · Personnel File</title>
  <style>
    body { font-family: monospace; background: #0a0e14; color: #d0d7de; padding: 2rem; }
    .card { background: #161b22; border: 1px solid #30363d; padding: 1.5rem; max-width: 520px; }
    .label { color: #8b949e; font-size: 0.85rem; }
    .val { color: #58a6ff; font-weight: bold; margin-bottom: 0.8rem; }
    a { color: #58a6ff; }
  </style>
</head>
<body>
  <h2>VANGUARD DEFENSE // PERSONNEL ARCHIVE</h2>
  <div class="card">
    <div class="label">CURRENT OPERATOR ID:</div>
    <div class="val">104</div>
    <div class="label">CALLSIGN:</div>
    <div class="val">operator_junior</div>
    <div class="label">ROLE:</div>
    <div class="val">Field Scout (Tier-1)</div>
    <div class="label">ASSIGNED REST API ENDPOINT:</div>
    <div class="val"><a href="/api/user/profile?id=104">/api/user/profile?id=104</a></div>
    <div class="label">ASSIGNED FINANCIALS ENDPOINT:</div>
    <div class="val"><a href="/api/invoices?userId=104">/api/invoices?userId=104</a></div>
  </div>
</body>
</html>`,
    };
  }

  // GET /api/user/profile?id=... (IDOR vulnerability)
  if (req.path === "/api/user/profile") {
    const id = req.query.id;
    const profiles: Record<string, unknown> = {
      "104": {
        id: 104,
        handle: "operator_junior",
        role: "Field Scout",
        clearance: "Tier-1",
        email: "junior@vanguard.lab",
      },
      "101": {
        id: 101,
        handle: "chief_director",
        role: "Chief Information Security Officer",
        clearance: "Tier-0 Classified",
        email: "ciso@vanguard.lab",
        secret_notes: `UNAUTHORIZED_ACCESS_DETECTED! FLAG: ${flags.flag_idor_profile}`,
      },
      "102": {
        id: 102,
        handle: "lead_architect",
        role: "Infrastructure Lead",
        clearance: "Tier-0",
        email: "architect@vanguard.lab",
      },
    };

    if (id && profiles[id]) {
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profiles[id], null, 2),
      };
    }

    return {
      status: 404,
      statusText: "Not Found",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: `User profile with id '${id}' not found.` }, null, 2),
    };
  }

  // GET /api/invoices?userId=... (IDOR on financial invoices)
  if (req.path === "/api/invoices") {
    const userId = req.query.userId;
    if (userId === "101") {
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          {
            userId: 101,
            organization: "Vanguard Black Budget Ops",
            invoices: [
              { invId: "INV-9021", amount: "$850,000", vendor: "CyberDefense Labs" },
              { invId: "INV-9022", amount: "$1,200,000", flag: flags.flag_idor_invoice },
            ],
          },
          null,
          2,
        ),
      };
    }

    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        {
          userId: Number(userId) || 104,
          invoices: [{ invId: "INV-104-01", amount: "$45.00", vendor: "Cloud Storage Lite" }],
        },
        null,
        2,
      ),
    };
  }

  return {
    status: 404,
    statusText: "Not Found",
    headers: { "Content-Type": "text/html" },
    body: `<h3>404 Not Found</h3>`,
  };
}

// -----------------------------------------------------------------------------
// 4. Rank 2 Capstone: Operation Watchtower
// -----------------------------------------------------------------------------
function handleR2Capstone(
  req: HttpRequest,
  env: WebAppEnv,
  cookies: Record<string, string>,
): HttpResponse {
  const flags = env.config.flags as Record<string, string>;

  // GET /api/contracts?ref=... (IDOR)
  if (req.path === "/api/contracts") {
    const ref = req.query.ref;
    if (ref === "CTR-7701" || ref === "7701" || ref === "topsecret") {
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          {
            contractRef: "CTR-7701",
            classification: "TOP_SECRET // EYES ONLY",
            payload: flags.flag_capstone_idor,
          },
          null,
          2,
        ),
      };
    }
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractRef: ref || "CTR-1001", status: "STANDARD_TIER" }, null, 2),
    };
  }

  // GET /orders/lookup (SQLi)
  if (req.path === "/orders/lookup") {
    const code = req.query.code || "";
    const isSqli =
      code.toLowerCase().includes("or") &&
      (code.includes("1=1") || code.includes("'1'='1") || code.includes("'='"));

    if (isSqli) {
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          {
            status: "SQL_DUMP_DISCLOSED",
            records: [
              { orderId: "ORD-99", customer: "Internal Audit", flag: flags.flag_capstone_sqli },
            ],
          },
          null,
          2,
        ),
      };
    }

    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: code || "ORD-01", status: "PENDING" }, null, 2),
    };
  }

  // GET /admin/debug (Token privilege escalation)
  if (req.path === "/admin/debug") {
    const roleCookie = cookies.watchtower_role;
    if (roleCookie === "superadmin" || roleCookie === "admin") {
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          {
            access: "AUTHORIZED",
            root_flag: flags.flag_capstone_root,
          },
          null,
          2,
        ),
      };
    }

    return {
      status: 403,
      statusText: "Forbidden",
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "watchtower_role=analyst; Path=/",
      },
      body: JSON.stringify({ error: "Access denied. Requires role=superadmin." }, null, 2),
    };
  }

  // Default portal landing
  return {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "text/html" },
    body: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Operation Watchtower · Command Portal</title>
  <style>
    body { font-family: monospace; background: #0a0e14; color: #d0d7de; padding: 2rem; }
    .card { background: #161b22; border: 1px solid #30363d; padding: 1.5rem; max-width: 600px; margin-bottom: 1.5rem; }
    a { color: #58a6ff; }
  </style>
</head>
<body>
  <h2>OPERATION WATCHTOWER // COMMAND PORTAL</h2>
  <div class="card">
    <p>Target subsystems active:</p>
    <ul>
      <li><a href="/api/contracts?ref=CTR-1001">Contract Archive API (IDOR Vector)</a></li>
      <li><a href="/orders/lookup?code=ORD-01">Order Verification Engine (SQLi Vector)</a></li>
      <li><a href="/admin/debug">Privileged Debug Console (Role Cookie Vector)</a></li>
    </ul>
  </div>
</body>
</html>`,
  };
}

// -----------------------------------------------------------------------------
// 5. Pentest L1 Web Attacks Portal (SQLi Auth Bypass & LFI Traversal)
// -----------------------------------------------------------------------------
function handlePentestWebPortal(
  req: HttpRequest,
  env: WebAppEnv,
  cookies: Record<string, string>,
): HttpResponse {
  const flags = env.config.flags as Record<string, string>;

  if (req.path === "/" || req.path === "") {
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><head><title>Apex Systems Gateway</title><style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem;}a{color:#58a6ff;}</style></head><body><h1>APEX CORP // INTERNAL GATEWAY</h1><p>Active internal endpoints:</p><ul><li><a href="/login">Staff Access Portal</a></li><li><a href="/document?file=welcome.txt">Public Briefing Archive</a></li></ul></body></html>`,
    };
  }

  if (req.method === "GET" && req.path === "/login") {
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><head><title>Staff Login</title><style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem;}.card{background:#161b22;padding:2rem;max-width:400px;margin:auto;}input,button{width:100%;padding:8px;margin:8px 0;box-sizing:border-box;}</style></head><body><div class="card"><h2>STAFF AUTHENTICATION</h2><form method="POST" action="/login"><input type="text" name="username" placeholder="Username" required /><input type="password" name="password" placeholder="Password" required /><button type="submit">LOGIN</button></form></div></body></html>`,
    };
  }

  if (req.method === "POST" && req.path === "/login") {
    const form = parseFormBody(req.body);
    const u = form.username || "";
    const p = form.password || "";
    const isSqli =
      u.includes("' OR 1=1") ||
      u.includes("' or 1=1") ||
      u.includes("' OR '1'='1") ||
      u.includes("' or '1'='1") ||
      u.includes("admin' --") ||
      u.includes("admin' #") ||
      p.includes("' OR 1=1");

    if (isSqli) {
      return {
        status: 302,
        statusText: "Found",
        headers: {
          "Set-Cookie": "staff_session=valid_token; Path=/; HttpOnly",
          Location: "/dashboard",
        },
        body: `<p>Logged in. Redirecting to <a href="/dashboard">dashboard</a>...</p>`,
      };
    }
    return {
      status: 401,
      statusText: "Unauthorized",
      headers: { "Content-Type": "text/html" },
      body: `<h3>Authentication Failed: Invalid credentials</h3><a href="/login">Try again</a>`,
    };
  }

  if (req.method === "GET" && req.path === "/dashboard") {
    if (cookies.staff_session) {
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "text/html" },
        body: `<!DOCTYPE html><html><head><title>Staff Dashboard</title><style>body{background:#0d1117;color:#3fb950;font-family:monospace;padding:2rem;}</style></head><body><h1>ACCESS GRANTED // ADMINISTRATOR</h1><p>SQL Injection Auth Bypass Verified!</p><div style="border:1px solid #3fb950;padding:1rem;">AUTH FLAG: <strong>${flags.flag_auth}</strong></div></body></html>`,
      };
    }
    return {
      status: 302,
      statusText: "Found",
      headers: { Location: "/login" },
      body: `<a href="/login">Redirecting to login</a>`,
    };
  }

  if (req.method === "GET" && req.path === "/document") {
    const file = req.query.file || "";
    if (file.includes("..") || file.includes("etc/passwd") || file.includes("passwd")) {
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "text/plain" },
        body: `root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\noperator:x:1000:1000:Operator,,,:/home/operator:/bin/bash\n# LFI EXPLOIT FLAG: ${flags.flag_lfi}`,
      };
    }
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/plain" },
      body: `Welcome to Apex Systems.\nAll activities on this network are audited.\nAuthorized access only.`,
    };
  }

  return {
    status: 404,
    statusText: "Not Found",
    headers: { "Content-Type": "text/html" },
    body: `<h1>404 Not Found</h1>`,
  };
}

// -----------------------------------------------------------------------------
// 6. Pentest L1 Capstone Portal
// -----------------------------------------------------------------------------
function handlePentestCapstonePortal(
  req: HttpRequest,
  env: WebAppEnv,
  cookies: Record<string, string>,
): HttpResponse {
  const flags = env.config.flags as Record<string, string>;

  if (req.path === "/" || req.path === "") {
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><head><title>Apex Command Core</title><style>body{background:#090d13;color:#7ee787;font-family:monospace;padding:2rem;}a{color:#58a6ff;}</style></head><body><h1>APEX ENTERPRISE CORE // VAPT TARGET</h1><p>Engage authorized test protocol:</p><ul><li><a href="/recon">Reconnaissance Directory</a></li><li><a href="/login">Executive Vault</a></li></ul></body></html>`,
    };
  }

  if (req.method === "GET" && req.path === "/recon") {
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><body style="background:#090d13;color:#c9d1d9;font-family:monospace;padding:2rem;"><h2>SYSTEM RECON REPOSITORY</h2><p>Identified internal asset: 198.51.100.25 (SMB/HTTP)</p><p>RECON FLAG: <strong>${flags.flag_recon}</strong></p></body></html>`,
    };
  }

  if (req.method === "GET" && req.path === "/login") {
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><body style="background:#090d13;color:#c9d1d9;font-family:monospace;padding:2rem;"><form method="POST" action="/login"><input type="text" name="username" placeholder="Username" /><input type="password" name="password" placeholder="Password" /><button type="submit">ENTER</button></form></body></html>`,
    };
  }

  if (req.method === "POST" && req.path === "/login") {
    const form = parseFormBody(req.body);
    const u = form.username || "";
    if (u.includes("' OR 1=1") || u.includes("admin' --") || u.includes("' or 1=1")) {
      return {
        status: 302,
        statusText: "Found",
        headers: {
          "Set-Cookie": "capstone_auth=admin_ok; Path=/; HttpOnly",
          Location: "/admin/secrets",
        },
        body: `<p>Redirecting...</p>`,
      };
    }
    return { status: 401, statusText: "Unauthorized", headers: { "Content-Type": "text/html" }, body: `<p>Failed</p>` };
  }

  if (req.method === "GET" && req.path === "/admin/secrets") {
    if (cookies.capstone_auth === "admin_ok") {
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "text/html" },
        body: `<!DOCTYPE html><html><body style="background:#090d13;color:#3fb950;font-family:monospace;padding:2rem;"><h1>EXECUTIVE SECRETS ARCHIVE</h1><p>FULL COMPROMISE ACHIEVED!</p><p>CAPSTONE EXPLOIT FLAG: <strong>${flags.flag_exploit}</strong></p></body></html>`,
      };
    }
    return { status: 302, statusText: "Found", headers: { Location: "/login" }, body: `<p>Login first</p>` };
  }

  return { status: 404, statusText: "Not Found", headers: { "Content-Type": "text/html" }, body: `<h1>404 Not Found</h1>` };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
