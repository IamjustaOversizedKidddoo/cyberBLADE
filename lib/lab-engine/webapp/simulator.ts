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
    case "pentest_sqli_union":
      res = handlePentestSqliUnion(req, env);
      break;
    case "pentest_sqli_blind":
      res = handlePentestSqliBlind(req, env);
      break;
    case "pentest_cmdi":
      res = handlePentestCmdi(req, env);
      break;
    case "pentest_xss_stored":
      res = handlePentestXssStored(req, env, cookies, database);
      break;
    case "pentest_file_upload":
      res = handlePentestFileUpload(req, env, database);
      break;
    case "pentest_idor":
      res = handlePentestIdor(req, env);
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

// -----------------------------------------------------------------------------
// 7. Pentest L1 SQLi UNION Column Extraction (pentest_sqli_union)
// -----------------------------------------------------------------------------
function handlePentestSqliUnion(req: HttpRequest, env: WebAppEnv): HttpResponse {
  const flags = env.config.flags as Record<string, string>;
  const category = (req.query.category || "").trim();

  const baseProducts = [
    { id: 1, name: "Industrial Server Chassis", cat: "hardware", price: "$850.00" },
    { id: 2, name: "Gigabit Managed Switch 48-Port", cat: "hardware", price: "$1,250.00" },
    { id: 3, name: "Cat6A Shielded Patch Cable (10m)", cat: "cables", price: "$35.00" },
    { id: 4, name: "Hardware Security Module (HSM)", cat: "security", price: "$4,500.00" },
  ];

  if (!category) {
    const rows = baseProducts
      .map(
        (p) =>
          `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.cat}</td><td>${p.price}</td></tr>`,
      )
      .join("");

    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><head><title>Apex Logistics Catalog</title><style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem;}table{border-collapse:collapse;width:100%;margin-top:1rem;}th,td{border:1px solid #30363d;padding:8px;text-align:left;}th{background:#161b22;}</style></head><body><h1>APEX HARDWARE // INVENTORY CATALOG</h1><p>Filter by category: <a href="/products?category=hardware">Hardware</a> | <a href="/products?category=cables">Cables</a> | <a href="/products?category=security">Security</a></p><table><tr><th>Item ID</th><th>Item Name</th><th>Category</th><th>Price</th></tr>${rows}</table></body></html>`,
    };
  }

  const rawLower = category.toLowerCase();
  if (rawLower.includes("union") && rawLower.includes("select")) {
    const unionPart = rawLower.split("select")[1] || "";
    const cleanUnion = unionPart.split("--")[0].split("#")[0];
    const columns = cleanUnion.split(",").map((s) => s.trim());

    if (columns.length === 3) {
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "text/html" },
        body: `<!DOCTYPE html><html><head><title>Apex Logistics Catalog</title><style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem;}table{border-collapse:collapse;width:100%;margin-top:1rem;}th,td{border:1px solid #30363d;padding:8px;text-align:left;}th{background:#161b22;}</style></head><body><h1>APEX HARDWARE // INVENTORY CATALOG</h1><p>Query Filter: <code>${escapeHtml(category)}</code></p><p style="color:#3fb950;">[DATABASE INJECTION SUCCESSFUL: 3 COLUMNS MATCHED]</p><table><tr><th>Item ID</th><th>Item Name</th><th>Category</th></tr><tr><td>1</td><td>DATABASE_VERSION: PostgreSQL 14.7-ApexDB</td><td>FLAG: <strong>${flags.flag_db}</strong></td></tr></table></body></html>`,
      };
    } else {
      return {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "text/html" },
        body: `<!DOCTYPE html><html><body style="background:#0d1117;color:#f85149;font-family:monospace;padding:2rem;"><h2>DATABASE QUERY ERROR</h2><p>ERROR 1222 (21000): The used SELECT statements have a different number of columns.</p><p>Target Query: <code>SELECT id, name, category FROM products WHERE category = '${escapeHtml(category)}'</code></p></body></html>`,
      };
    }
  }

  const filtered = baseProducts.filter((p) => p.cat === category.toLowerCase());
  const rows = filtered
    .map(
      (p) =>
        `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.cat}</td><td>${p.price}</td></tr>`,
    )
    .join("");

  return {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html><html><head><title>Apex Logistics Catalog</title><style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem;}table{border-collapse:collapse;width:100%;margin-top:1rem;}th,td{border:1px solid #30363d;padding:8px;text-align:left;}th{background:#161b22;}</style></head><body><h1>APEX HARDWARE // INVENTORY CATALOG</h1><p>Category: <code>${escapeHtml(category)}</code> (<a href="/products">View All</a>)</p><table><tr><th>Item ID</th><th>Item Name</th><th>Category</th><th>Price</th></tr>${rows}</table></body></html>`,
  };
}

// -----------------------------------------------------------------------------
// 8. Pentest L1 Boolean-Based Blind SQLi (pentest_sqli_blind)
// -----------------------------------------------------------------------------
function handlePentestSqliBlind(req: HttpRequest, env: WebAppEnv): HttpResponse {
  const flags = env.config.flags as Record<string, string>;
  const idParam = (req.query.id || "").trim();

  if (!idParam) {
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><head><title>Member Registry Verification</title><style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem;}input,button{padding:8px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;}</style></head><body><h1>APEX MEMBERSHIP // VERIFICATION PORTAL</h1><p>Query membership status by Member ID (e.g. 101):</p><form method="GET" action="/verify"><input type="text" name="id" placeholder="Member ID" value="101" /><button type="submit">Verify Status</button></form></body></html>`,
    };
  }

  const rawLower = idParam.toLowerCase();

  let isTrue = false;
  if (idParam === "101") {
    isTrue = true;
  } else if (rawLower.includes("101 and 1=1") || rawLower.includes("101' and '1'='1") || rawLower.includes("101 and true")) {
    isTrue = true;
  } else if (rawLower.includes("101 and 1=2") || rawLower.includes("101' and '1'='2") || rawLower.includes("101 and false")) {
    isTrue = false;
  } else if (rawLower.includes("substr") || rawLower.includes("substring")) {
    if (rawLower.includes("'a'") || rawLower.includes('"a"') || rawLower.includes("=65")) {
      isTrue = true;
    } else {
      isTrue = false;
    }
  } else if (idParam.startsWith("101")) {
    isTrue = true;
  }

  const resultMarkup = isTrue
    ? `<div style="border:1px solid #3fb950;background:#0d2818;color:#3fb950;padding:1rem;margin-top:1rem;"><strong>STATUS: VERIFIED</strong><p>Member ID 101 is registered as an Active Executive Operative.</p><p style="font-size:11px;color:#8b949e;">[BLIND INFERENCE KEY: ${flags.flag_blind}]</p></div>`
    : `<div style="border:1px solid #f85149;background:#251014;color:#f85149;padding:1rem;margin-top:1rem;"><strong>STATUS: NOT FOUND</strong><p>No active member record corresponds to query criteria.</p></div>`;

  return {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html><html><head><title>Member Registry Verification</title><style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem;}input,button{padding:8px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;}</style></head><body><h1>APEX MEMBERSHIP // VERIFICATION PORTAL</h1><form method="GET" action="/verify"><input type="text" name="id" placeholder="Member ID" value="${escapeHtml(idParam)}" /><button type="submit">Verify Status</button></form>${resultMarkup}</body></html>`,
  };
}

// -----------------------------------------------------------------------------
// 9. Pentest L1 Command Injection (pentest_cmdi)
// -----------------------------------------------------------------------------
function handlePentestCmdi(req: HttpRequest, env: WebAppEnv): HttpResponse {
  const flags = env.config.flags as Record<string, string>;

  let executedOutput = "";
  let hostInput = "127.0.0.1";

  if (req.method === "POST" && req.path.includes("ping")) {
    const form = parseFormBody(req.body);
    hostInput = form.ip || form.host || "127.0.0.1";

    const hasCmdi =
      hostInput.includes(";") ||
      hostInput.includes("|") ||
      hostInput.includes("&&") ||
      hostInput.includes("`") ||
      hostInput.includes("$(");

    if (hasCmdi) {
      const lower = hostInput.toLowerCase();
      let cmdOut = "";
      if (lower.includes("whoami")) {
        cmdOut += "apex-operator\n";
      }
      if (lower.includes("hostname")) {
        cmdOut += "apex-edge-router\n";
      }
      if (lower.includes("id")) {
        cmdOut += "uid=1001(apex-operator) gid=1001(apex-operator) groups=1001(apex-operator)\n";
      }
      if (
        lower.includes("cat /etc/apex_release") ||
        lower.includes("cat /etc/*") ||
        lower.includes("flag") ||
        lower.includes("ls")
      ) {
        cmdOut += `APEX OS v4.2.1-HARDENED\nPROOF OF RCE: ${flags.flag_cmdi}\n`;
      }
      if (!cmdOut) {
        cmdOut = `apex-edge-router: /bin/sh: command executed successfully\n`;
      }

      executedOutput = `PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.\n64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.042 ms\n--- 127.0.0.1 ping statistics ---\n1 packets transmitted, 1 received, 0% packet loss\n\n[INJECTED COMMAND OUTPUT]:\n${cmdOut}`;
    } else {
      executedOutput = `PING ${escapeHtml(hostInput)} (${escapeHtml(hostInput)}) 56(84) bytes of data.\n64 bytes from ${escapeHtml(hostInput)}: icmp_seq=1 ttl=64 time=0.038 ms\n64 bytes from ${escapeHtml(hostInput)}: icmp_seq=2 ttl=64 time=0.041 ms\n--- ${escapeHtml(hostInput)} ping statistics ---\n2 packets transmitted, 2 received, 0% packet loss`;
    }
  }

  return {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html><html><head><title>Network Diagnostics</title><style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem;}input,button{padding:8px;background:#161b22;color:#c9d1d9;border:1px solid #30363d;}pre{background:#161b22;border:1px solid #30363d;padding:1rem;color:#7ee787;overflow-x:auto;}</style></head><body><h1>APEX INFRASTRUCTURE // NETWORK DIAGNOSTIC CONSOLE</h1><p>ICMP Echo Diagnostic Tool (ping):</p><form method="POST" action="/tools/ping"><input type="text" name="ip" value="${escapeHtml(hostInput)}" style="width:300px;" /><button type="submit">Execute Diagnostic</button></form>${executedOutput ? `<h3>Command Execution Results:</h3><pre>${escapeHtml(executedOutput)}</pre>` : ""}</body></html>`,
  };
}

// -----------------------------------------------------------------------------
// 10. Pentest L1 Stored XSS (pentest_xss_stored)
// -----------------------------------------------------------------------------
function handlePentestXssStored(
  req: HttpRequest,
  env: WebAppEnv,
  _cookies: Record<string, string>,
  database: Record<string, Array<Record<string, unknown>>>,
): HttpResponse {
  const flags = env.config.flags as Record<string, string>;
  const feedbackList = (database.feedback as Array<{ id: number; author: string; msg: string; time: string }>) || [];

  if (feedbackList.length === 0) {
    feedbackList.push(
      { id: 1, author: "System Health Monitor", msg: "All gateway services operational at nominal latency.", time: "10:00:00" },
      { id: 2, author: "Security Officer", msg: "Reminder: rotate administrative API keys before Friday.", time: "10:15:22" },
    );
    database.feedback = feedbackList;
  }

  let adminReviewAlert = "";

  if (req.method === "POST") {
    const form = parseFormBody(req.body);
    const author = form.author || "Anonymous";
    const msg = form.message || "";

    if (msg.trim()) {
      feedbackList.push({
        id: feedbackList.length + 1,
        author,
        msg,
        time: new Date().toISOString().slice(11, 19),
      });

      const lower = msg.toLowerCase();
      if (lower.includes("<script") || lower.includes("onerror=") || lower.includes("onload=") || lower.includes("javascript:")) {
        adminReviewAlert = `<div style="border:1px solid #f85149;background:#251014;color:#f85149;padding:1rem;margin-top:1rem;"><strong>[ADMIN BOT NOTICE]:</strong> Stored payload executed in administrator review session! Intercepted admin session cookie: <code>adm_sess_token=9a82bf01c</code>.<br />STORED XSS FLAG: <strong>${flags.flag_xss}</strong></div>`;
      }
    }
  }

  const renderedMessages = feedbackList
    .map(
      (m) =>
        `<div style="border-bottom:1px solid #30363d;padding:8px 0;"><span style="color:#58a6ff;">${escapeHtml(m.author)}</span> <span style="color:#8b949e;font-size:11px;">[${m.time}]</span><p style="margin:4px 0;">${m.msg}</p></div>`,
    )
    .join("");

  return {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html><html><head><title>Apex Community Board</title><style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem;}input,textarea,button{width:100%;padding:8px;margin:4px 0;background:#161b22;color:#c9d1d9;border:1px solid #30363d;box-sizing:border-box;}</style></head><body><h1>APEX OPERATIONS // ACTIVITY LOG</h1>${adminReviewAlert}<div style="margin:2rem 0;background:#161b22;padding:1rem;border:1px solid #30363d;"><h3>Submit Incident Update</h3><form method="POST" action="/feedback"><input type="text" name="author" placeholder="Your Handle / ID" /><textarea name="message" placeholder="Message content..." rows="3"></textarea><button type="submit">Submit Entry</button></form></div><h3>Recorded Updates</h3>${renderedMessages}</body></html>`,
  };
}

// -----------------------------------------------------------------------------
// 11. Pentest L1 File Upload Bypass (pentest_file_upload)
// -----------------------------------------------------------------------------
function handlePentestFileUpload(
  req: HttpRequest,
  env: WebAppEnv,
  database: Record<string, Array<Record<string, unknown>>>,
): HttpResponse {
  const flags = env.config.flags as Record<string, string>;
  const uploads = (database.uploads as Array<{ filename: string; path: string; executable: boolean }>) || [];
  database.uploads = uploads;

  if (req.path.startsWith("/uploads/")) {
    const requestedFile = req.path.replace("/uploads/", "") || req.query.file || "";
    const matched = uploads.find((u) => u.filename === requestedFile || u.path.endsWith(requestedFile));
    if (matched && matched.executable) {
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "text/html" },
        body: `<!DOCTYPE html><html><body style="background:#090d13;color:#3fb950;font-family:monospace;padding:2rem;"><h1>PHP BACKDOOR EXECUTED</h1><p>Current Process: www-data (uid=33)</p><div style="border:1px solid #3fb950;padding:1rem;">FILE UPLOAD EXPLOIT FLAG: <strong>${flags.flag_upload}</strong></div></body></html>`,
      };
    }
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "text/plain" },
      body: `File ${requestedFile} loaded as static image artifact.`,
    };
  }

  let uploadNotice = "";
  if (req.method === "POST" && req.path.includes("upload")) {
    const form = parseFormBody(req.body);
    const filename = form.filename || "avatar.png";
    const contentType = form.content_type || "image/png";

    const isImageMime = contentType.includes("image/png") || contentType.includes("image/jpeg");
    const isPhp = filename.endsWith(".php") || filename.includes(".php.");

    if (isImageMime) {
      const publicPath = `/uploads/${filename}`;
      uploads.push({
        filename,
        path: publicPath,
        executable: isPhp,
      });

      uploadNotice = `<div style="border:1px solid #3fb950;background:#0d2818;color:#3fb950;padding:1rem;margin-top:1rem;"><strong>FILE UPLOAD SUCCESSFUL</strong><p>File saved to: <a href="${publicPath}">${publicPath}</a></p></div>`;
    } else {
      uploadNotice = `<div style="border:1px solid #f85149;background:#251014;color:#f85149;padding:1rem;margin-top:1rem;"><strong>UPLOAD REJECTED</strong><p>Only image MIME types (image/png, image/jpeg) permitted.</p></div>`;
    }
  }

  return {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html><html><head><title>Profile Image Management</title><style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem;}input,button{padding:8px;margin:4px 0;background:#161b22;color:#c9d1d9;border:1px solid #30363d;}</style></head><body><h1>APEX STAFF // PROFILE ASSET UPLOADER</h1><p>Upload security badge avatar:</p><form method="POST" action="/upload"><p>Filename: <input type="text" name="filename" value="avatar.php.png" style="width:250px;" /></p><p>Content-Type Header: <input type="text" name="content_type" value="image/png" style="width:250px;" /></p><button type="submit">Upload Image</button></form>${uploadNotice}<h3>Uploaded Artifacts in /uploads/:</h3><ul>${uploads.map((u) => `<li><a href="${u.path}">${u.filename}</a></li>`).join("")}</ul></body></html>`,
  };
}

// -----------------------------------------------------------------------------
// 12. Pentest L1 IDOR Record Tampering (pentest_idor)
// -----------------------------------------------------------------------------
function handlePentestIdor(req: HttpRequest, env: WebAppEnv): HttpResponse {
  const flags = env.config.flags as Record<string, string>;
  const idParam = (req.query.id || "204").trim();

  const patientRecords: Record<string, { name: string; room: string; status: string; notes: string; clearanceFlag?: string }> = {
    "201": {
      name: "Senator Evelyn Vance",
      room: "VIP Suite 01",
      status: "Confidential - Executive Priority",
      notes: "Admitted under diplomatic medical immunity protocol. Clearance active.",
      clearanceFlag: flags.flag_idor,
    },
    "202": {
      name: "Arthur Pendelton",
      room: "Ward B, Room 102",
      status: "Routine Observation",
      notes: "Post-operative follow-up standard prescription issued.",
    },
    "203": {
      name: "Marcus Brody",
      room: "Ward C, Room 205",
      status: "Discharged",
      notes: "Patient records archived for institutional insurance audit.",
    },
    "204": {
      name: "Johnathan Doe",
      room: "Outpatient Clinic",
      status: "Standard Consultation",
      notes: "Annual executive physical examination completed.",
    },
  };

  const patient = patientRecords[idParam];

  const detailsHtml = patient
    ? `<div style="border:1px solid #30363d;background:#161b22;padding:1.5rem;margin-top:1rem;">
         <h2 style="color:#58a6ff;margin-top:0;">PATIENT DOSSIER: ${escapeHtml(patient.name)}</h2>
         <p><strong>Record ID:</strong> ${escapeHtml(idParam)}</p>
         <p><strong>Assigned Room:</strong> ${escapeHtml(patient.room)}</p>
         <p><strong>Clinical Status:</strong> ${escapeHtml(patient.status)}</p>
         <p><strong>Medical Notes:</strong> ${escapeHtml(patient.notes)}</p>
         ${patient.clearanceFlag ? `<div style="border:1px solid #3fb950;background:#0d2818;color:#3fb950;padding:1rem;margin-top:1rem;"><strong>IDOR BREACH SUCCESSFUL:</strong><br />CONFIDENTIAL MEDICAL CLEARANCE FLAG: <strong>${patient.clearanceFlag}</strong></div>` : ""}
       </div>`
    : `<div style="border:1px solid #f85149;background:#251014;color:#f85149;padding:1rem;margin-top:1rem;">No patient record found for ID ${escapeHtml(idParam)}.</div>`;

  return {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html><html><head><title>Apex Health Systems - Patient Portal</title><style>body{background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem;}a{color:#58a6ff;}</style></head><body><h1>APEX HEALTH SYSTEMS // PATIENT RECORD REPOSITORY</h1><p>Viewing Record for Active Session: <a href="/patient/records?id=204">My Record (ID: 204)</a></p>${detailsHtml}</body></html>`,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
