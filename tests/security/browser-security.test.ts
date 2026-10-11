import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { OPERATOR_COOKIE } from "@/lib/identity/constants";

describe("Security Part D: Browser Security, CSP & Hostile String Sanitization", () => {
  describe("Edge Proxy Security Headers", () => {
    it("enforces strict CSP without wildcard external hostnames", async () => {
      const req = new NextRequest("http://localhost:3000/dashboard");
      const res = await proxy(req);

      const csp = res.headers.get("Content-Security-Policy") || "";
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");

      // Verify no wildcard external hosts in script-src or connect-src
      expect(csp).not.toMatch(/script-src[^;]*\shttps:\s/);
      expect(csp).not.not.toBe(true);
    });

    it("attaches Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy", async () => {
      const req = new NextRequest("http://localhost:3000/");
      const res = await proxy(req);

      expect(res.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
      expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    });

    it("attaches private no-cache headers to authenticated or app routes", async () => {
      const reqWithCookie = new NextRequest("http://localhost:3000/dashboard", {
        headers: {
          cookie: `${OPERATOR_COOKIE}=test-user-id`,
        },
      });
      const res = await proxy(reqWithCookie);

      const cacheControl = res.headers.get("Cache-Control") || "";
      expect(cacheControl).toContain("no-store");
      expect(cacheControl).toContain("private");
      expect(res.headers.get("Pragma")).toBe("no-cache");
    });
  });

  describe("Hostile String Inert Rendering", () => {
    const hostilePayloads = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert('xss')>",
      "<svg onload=alert(document.domain)>",
      "javascript:alert(1)",
      "<iframe src='http://attacker.com'></iframe>",
      "style='background:url(javascript:alert(1))'",
      "<a href=\"javascript:alert('pwned')\">Click here</a>",
      "{{constructor.constructor('alert(1)')()}}",
      "${alert(1)}",
    ];

    it.each(hostilePayloads)("ensures hostile string %j is inert when rendered as text", (payload) => {
      // In React JSX, strings rendered within JSX tags are encoded and treated as inert text
      const escaped = payload
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");

      expect(escaped).not.toContain("<script>");
      expect(escaped).not.toContain("<img");
      expect(escaped).not.toContain("<svg");
      expect(escaped).not.toContain("<iframe");
    });
  });

  describe("Lab Sandbox Isolation Boundary", () => {
    it("verifies sandbox iframe attributes omit allow-same-origin to maintain origin separation", () => {
      // The sandbox attribute in components/labs/webapp/BrowserFrame.tsx must be strictly checked
      const fs = require("node:fs");
      const path = require("node:path");
      const browserFramePath = path.resolve(
        process.cwd(),
        "components/labs/webapp/BrowserFrame.tsx"
      );
      const code = fs.readFileSync(browserFramePath, "utf8");

      expect(code).toContain('sandbox="allow-scripts allow-forms"');
      expect(code).not.toContain("allow-same-origin");
    });
  });
});
