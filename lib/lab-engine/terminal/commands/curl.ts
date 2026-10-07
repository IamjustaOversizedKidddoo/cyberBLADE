import { lookupTarget, type HttpResponse } from "../network";
import type { Command } from "./types";
import { fail, ok } from "./util";

const URL_RE = /^(https?):\/\/([^/:]+)(?::(\d+))?(\/.*)?$/i;

type Target = { scheme: string; host: string; port: number; path: string };

function parseUrl(raw: string): Target | null {
  const m = (/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).match(URL_RE);
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  return { scheme, host: m[2], port: m[3] ? Number(m[3]) : scheme === "https" ? 443 : 80, path: m[4] ?? "/" };
}

const statusLine = (r: HttpResponse) => `HTTP/1.1 ${r.status} ${r.reason}\n`;
const headersText = (r: HttpResponse) => statusLine(r) + r.headers.map(([k, v]) => `${k}: ${v}\n`).join("") + "\n";

/** curl 8 subset: -I (headers), -L (follow redirects), -s (silent). */
export const curl: Command = {
  name: "curl",
  summary: "fetch a web page: curl http://host/path, curl -I (headers only), -L (follow redirects)",
  run(ctx) {
    const flags = new Set<string>();
    let url: string | undefined;
    for (const a of ctx.argv.slice(1)) {
      if (a.startsWith("-") && a.length > 1) {
        for (const f of a.slice(1)) {
          if (!"ILsi".includes(f)) return fail(`curl: option -${f}: is unknown\ncurl: try 'curl --help' for more information\n`, 2);
          flags.add(f);
        }
      } else url ??= a;
    }
    if (!url) return fail("curl: try 'curl --help' for more information\n", 2);

    const net = ctx.network;
    const responses: HttpResponse[] = [];
    let target = parseUrl(url);
    if (!target) return fail(`curl: (3) URL rejected: Bad hostname\n`, 3);

    for (let hop = 0; ; hop++) {
      if (hop > 5) return fail("curl: (47) Maximum (5) redirects followed\n", 47);
      const found = net ? lookupTarget(net, target.host) : { error: "NXDOMAIN" as const };
      if ("error" in found) return fail(`curl: (6) Could not resolve host: ${target.host}\n`, 6);
      const host = found.host;
      if (!host?.reachable || !host.openPorts?.includes(target.port)) {
        return fail(`curl: (7) Failed to connect to ${target.host} port ${target.port} after 3 ms: Couldn't connect to server\n`, 7);
      }
      const pages = (target.scheme === "https" ? host.https : undefined) ?? host.http;
      const server = pages?.["/"]?.headers.find(([k]) => k.toLowerCase() === "server");
      const res: HttpResponse = pages?.[target.path] ?? {
        status: 404,
        reason: "Not Found",
        headers: server ? [server] : [],
        body: "<html><body><h1>404 Not Found</h1></body></html>\n",
      };
      responses.push(res);
      const location = res.headers.find(([k]) => k.toLowerCase() === "location")?.[1];
      if (!flags.has("L") || res.status < 300 || res.status >= 400 || !location) break;
      target = location.startsWith("/") ? { ...target, path: location } : parseUrl(location);
      if (!target) return fail(`curl: (3) URL rejected: Bad hostname\n`, 3);
    }

    if (flags.has("I")) return ok(responses.map(headersText).join(""));
    const last = responses[responses.length - 1];
    return ok((flags.has("i") ? headersText(last) : "") + last.body);
  },
};
