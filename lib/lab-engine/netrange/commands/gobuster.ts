import type { NetRangeScenario, NetRangeState } from "../types";
import { findHostByIpOrName, isTargetRoutable } from "./util";

export function execGobuster(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number } {
  let targetUrl = "";
  let wordlist = "common.txt";

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "-u" || a === "--url") && i + 1 < argv.length) {
      targetUrl = argv[++i];
    } else if ((a === "-w" || a === "--wordlist") && i + 1 < argv.length) {
      wordlist = argv[++i];
    } else if (!a.startsWith("-") && a !== "dir" && !targetUrl) {
      targetUrl = a;
    }
  }

  if (!targetUrl) {
    return {
      stdout: "",
      stderr: "Error: the following required arguments were not provided:\n  -u, --url <URL>\n\nUsage: gobuster dir -u <URL> -w <WORDLIST> [OPTIONS]\n",
      code: 1,
    };
  }

  let parsedUrl: URL;
  try {
    const raw = targetUrl.startsWith("http://") || targetUrl.startsWith("https://") ? targetUrl : `http://${targetUrl}`;
    parsedUrl = new URL(raw);
  } catch {
    return { stdout: "", stderr: `Error: invalid URL provided: ${targetUrl}\n`, code: 1 };
  }

  const hostname = parsedUrl.hostname;
  const port = parsedUrl.port ? Number(parsedUrl.port) : 80;

  const host = findHostByIpOrName(scenario, hostname);
  if (!host) {
    return { stdout: "", stderr: `Error: failed to resolve host: ${hostname}\n`, code: 1 };
  }

  const iface = host.interfaces.find((i) => i.ip === hostname) ?? host.interfaces[0];
  if (!isTargetRoutable(iface.ip, state.routes)) {
    return {
      stdout: "",
      stderr: `Error: Get "${parsedUrl.toString()}": dial tcp ${iface.ip}:${port}: connect: network is unreachable\n`,
      code: 1,
    };
  }

  const httpSvc = host.services.find((s) => s.port === port || s.name === "http" || s.name === "https");
  if (!httpSvc) {
    return {
      stdout: "",
      stderr: `Error: Get "${parsedUrl.toString()}": dial tcp ${iface.ip}:${port}: connect: connection refused\n`,
      code: 1,
    };
  }

  const endpoints = httpSvc.httpData ?? {
    "/": { status: 200, body: "Default portal" },
  };

  const results: string[] = [];
  for (const [path, ep] of Object.entries(endpoints)) {
    if (path === "/") continue;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const status = ep.status ?? 200;
    const size = ep.body.length;
    const redirectInfo = status === 301 || status === 302 ? ` [--> ${cleanPath}/]` : "";
    results.push(`${cleanPath.padEnd(22)} (Status: ${status}) [Size: ${size}]${redirectInfo}`);
  }

  const out = `
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     ${parsedUrl.toString()}
[+] Method:                  GET
[+] Wordlist:                ${wordlist.split("/").pop()}
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
===============================================================
Starting gobuster directory enumeration
===============================================================
${results.length > 0 ? results.join("\n") : "/* No additional endpoints discovered */"}
===============================================================
Finished
===============================================================
`;

  return { stdout: out.trim() + "\n", stderr: "", code: 0 };
}

export function execFfuf(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number } {
  let targetUrl = "";
  let wordlist = "rockyou.txt";

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "-u" || a === "--url") && i + 1 < argv.length) {
      targetUrl = argv[++i];
    } else if ((a === "-w" || a === "--wordlist") && i + 1 < argv.length) {
      wordlist = argv[++i];
    } else if (!a.startsWith("-") && !targetUrl) {
      targetUrl = a;
    }
  }

  if (!targetUrl || !targetUrl.includes("FUZZ")) {
    return {
      stdout: "",
      stderr: "Error: URL missing or does not contain 'FUZZ' keyword (e.g. ffuf -u http://target/FUZZ -w wordlist.txt)\n",
      code: 1,
    };
  }

  const urlPrefix = targetUrl.replace(/FUZZ.*$/, "");
  let parsedUrl: URL;
  try {
    const raw = urlPrefix.startsWith("http://") || urlPrefix.startsWith("https://") ? urlPrefix : `http://${urlPrefix}`;
    parsedUrl = new URL(raw);
  } catch {
    return { stdout: "", stderr: `Error: invalid URL provided: ${targetUrl}\n`, code: 1 };
  }

  const hostname = parsedUrl.hostname;
  const port = parsedUrl.port ? Number(parsedUrl.port) : 80;

  const host = findHostByIpOrName(scenario, hostname);
  if (!host) {
    return { stdout: "", stderr: `[ERROR] Failed to resolve target host: ${hostname}\n`, code: 1 };
  }

  const iface = host.interfaces.find((i) => i.ip === hostname) ?? host.interfaces[0];
  if (!isTargetRoutable(iface.ip, state.routes)) {
    return {
      stdout: "",
      stderr: `[ERROR] Connection failed: Get "${urlPrefix}": dial tcp ${iface.ip}:${port}: connect: network is unreachable\n`,
      code: 1,
    };
  }

  const httpSvc = host.services.find((s) => s.port === port || s.name === "http" || s.name === "https");
  if (!httpSvc) {
    return {
      stdout: "",
      stderr: `[ERROR] Connection failed: Get "${urlPrefix}": dial tcp ${iface.ip}:${port}: connect: connection refused\n`,
      code: 1,
    };
  }

  const endpoints = httpSvc.httpData ?? {
    "/": { status: 200, body: "Default portal" },
  };

  const rows: string[] = [];
  for (const [path, ep] of Object.entries(endpoints)) {
    if (path === "/") continue;
    const cleanWord = path.replace(/^\//, "");
    const status = ep.status ?? 200;
    const size = ep.body.length;
    const words = ep.body.split(/\s+/).filter(Boolean).length;
    const lines = ep.body.split("\n").length;
    rows.push(`${cleanWord.padEnd(24)}[Status: ${status}, Size: ${size}, Words: ${words}, Lines: ${lines}, Duration: 12ms]`);
  }

  const banner = `
        /'___\\  /'___\\           /'___\\       
       /\\ \\__/ /\\ \\__/  __  __  /\\ \\__/       
       \\ \\ ,__\\\\ \\ ,__\\/\\ \\/\\ \\ \\ \\ ,__\\      
        \\ \\ \\_/ \\ \\ \\_/\\ \\ \\_\\ \\ \\ \\ \\_/      
         \\ \\_\\   \\ \\_\\  \\ \\____/  \\ \\_\\       
          \\/_/    \\/_/   \\/___/    \\/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : ${targetUrl}
 :: Wordlist         : FUZZ: ${wordlist.split("/").pop()}
________________________________________________
`;

  const footer = `\n:: Progress: [1000/1000] :: Job [1/1] :: 250 req/sec :: Duration: [0:00:04] :: Errors: 0 ::`;

  return {
    stdout: banner.trim() + "\n\n" + (rows.length > 0 ? rows.join("\n") + "\n" : "") + footer + "\n",
    stderr: "",
    code: 0,
  };
}
