import type { NetRangeScenario, NetRangeState } from "../types";
import { findHostByIpOrName, isTargetRoutable } from "./util";

export function execCurl(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number } {
  let includeHeaders = false;
  let method: "GET" | "POST" = "GET";
  let targetUrl = "";

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-i" || a === "-I") {
      includeHeaders = true;
    } else if (a === "-d" || a === "--data") {
      method = "POST";
      i++; // skip post body
    } else if (a === "-X" && i + 1 < argv.length) {
      method = argv[++i].toUpperCase() as "GET" | "POST";
    } else if (!a.startsWith("-")) {
      targetUrl = a;
    }
  }

  if (!targetUrl) {
    return { stdout: "", stderr: "curl: try 'curl --help' for more information\n", code: 2 };
  }

  // Parse URL
  let parsedUrl: URL;
  try {
    const raw = targetUrl.startsWith("http://") || targetUrl.startsWith("https://") ? targetUrl : `http://${targetUrl}`;
    parsedUrl = new URL(raw);
  } catch {
    return { stdout: "", stderr: `curl: (3) URL malformed: ${targetUrl}\n`, code: 3 };
  }

  const hostname = parsedUrl.hostname;
  const port = parsedUrl.port ? Number(parsedUrl.port) : 80;
  const path = parsedUrl.pathname || "/";

  const host = findHostByIpOrName(scenario, hostname);
  if (!host) {
    return { stdout: "", stderr: `curl: (6) Could not resolve host: ${hostname}\n`, code: 6 };
  }

  const iface = host.interfaces.find((i) => i.ip === hostname) ?? host.interfaces[0];
  if (!isTargetRoutable(iface.ip, state.routes)) {
    return { stdout: "", stderr: `curl: (7) Failed to connect to ${hostname} port ${port}: Network is unreachable\n`, code: 7 };
  }

  const httpSvc = host.services.find((s) => s.port === port);
  if (!httpSvc) {
    return { stdout: "", stderr: `curl: (7) Failed to connect to ${hostname} port ${port}: Connection refused\n`, code: 7 };
  }

  const endpoints = httpSvc.httpData ?? {};
  const fullPathWithSearch = path + (parsedUrl.search || "");
  const matched =
    endpoints[fullPathWithSearch] ??
    endpoints[path] ??
    Object.entries(endpoints).find(([k]) => {
      if (k.includes("?")) {
        const [kPath, kQuery] = k.split("?");
        return (
          kPath === path &&
          (parsedUrl.search.includes(kQuery) ||
            kQuery.split("&").every((part) => parsedUrl.search.includes(part)))
        );
      }
      return false;
    })?.[1];
  const endpoint = (matched && (!matched.method || matched.method === method))
    ? matched
    : (path === "/" ? endpoints["/"] ?? {
        status: 200,
        body: `<!DOCTYPE html><html><head><title>${host.hostname}</title></head><body><h1>Welcome to ${host.hostname}</h1><p>Running ${httpSvc.version ?? "Apache"}</p></body></html>\n`,
      } : {
        status: 404,
        body: `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN"><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL ${path} was not found on this server.</p></body></html>\n`,
      });

  const status = endpoint.status ?? 200;
  const statusPhrases: Record<number, string> = {
    200: "OK",
    301: "Moved Permanently",
    302: "Found",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    500: "Internal Server Error",
  };

  const out: string[] = [];
  if (includeHeaders) {
    out.push(`HTTP/1.1 ${status} ${statusPhrases[status] ?? "OK"}`);
    out.push(`Date: Sat, 17 Oct 2026 11:55:00 GMT`);
    out.push(`Server: ${httpSvc.version ?? "Apache/2.4.41 (Ubuntu)"}`);
    out.push(`Content-Type: text/html; charset=UTF-8`);
    out.push(`Content-Length: ${endpoint.body.length}`);
    out.push(`Connection: close`);
    out.push("");
  }
  out.push(endpoint.body);

  return { stdout: out.join("\n") + (endpoint.body.endsWith("\n") ? "" : "\n"), stderr: "", code: 0 };
}
