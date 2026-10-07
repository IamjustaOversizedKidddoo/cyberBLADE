import { baseWorld, pickHostname, pickUsers } from "../terminal/base-world";
import type { Generator } from "../index";
import { formatFlag } from "../flag";
import { baseNetwork } from "./base-network";

/**
 * Rank 1 Networking Lab 3: HTTP & Web Services
 * Objectives:
 * o1: the Server header of the intranet site (server)
 * o2: where http://intranet.corp.example/ redirects (redirect, full URL)
 * o3: flag in the body of /admin/notes (flag)
 */
export const webLab: Generator = (rng) => {
  const [user] = pickUsers(rng, 1);
  const hostname = pickHostname(rng);
  const flag = formatFlag(rng.hex(12));

  const serverHeader = rng.pick(["nginx/1.24.0", "Apache/2.4.58", "Caddy/2.7.6", "lighttpd/1.4.74"]);
  const redirectPath = rng.pick(["/portal", "/dashboard", "/login", "/welcome", "/app"]);
  const intranetDomain = "intranet.corp.example";
  const redirectUrl = `http://${intranetDomain}${redirectPath}`;

  const { network } = baseNetwork(rng);

  const intranetIp = "10.0.2.50";
  network.dns[intranetDomain] = { A: [intranetIp] };
  network.hosts[intranetIp] = {
    name: intranetDomain,
    reachable: true,
    rttMs: 0.8,
    ttl: 64,
    hops: [intranetIp],
    openPorts: [80],
    http: {
      "/": {
        status: 301,
        reason: "Moved Permanently",
        headers: [
          ["Server", serverHeader],
          ["Location", redirectUrl],
          ["Content-Type", "text/html"],
        ],
        body: `<p>Moved to <a href="${redirectUrl}">${redirectUrl}</a></p>\n`,
      },
      [redirectPath]: {
        status: 200,
        reason: "OK",
        headers: [
          ["Server", serverHeader],
          ["Content-Type", "text/html"],
        ],
        body: "<h1>Intranet Portal</h1>\n<p>Authorized access only.</p>\n",
      },
      "/admin/notes": {
        status: 200,
        reason: "OK",
        headers: [
          ["Server", serverHeader],
          ["Content-Type", "text/plain"],
        ],
        body: `CONFIDENTIAL IT NOTES\nSystem admin handover: maintain certificate renewals.\nVerification code: ${flag}\n`,
      },
    },
  };

  const world = baseWorld({
    user,
    hostname,
  });
  world.network = network;

  return {
    env: { kind: "terminal", world },
    answers: {
      server: serverHeader,
      redirect: redirectUrl,
      flag,
    },
  };
};
