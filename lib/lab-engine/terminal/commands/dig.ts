import { normalizeName, type DnsRecords, type Network } from "../network";
import type { Command } from "./types";
import { ok } from "./util";

const TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "TXT"] as const;
type RrType = (typeof TYPES)[number];
type Rr = { name: string; type: RrType; data: string };

const fqdn = (n: string) => `${normalizeName(n)}.`;

function recordsOf(rec: DnsRecords, name: string, type: RrType): Rr[] {
  switch (type) {
    case "A":
      return (rec.A ?? []).map((data) => ({ name, type, data }));
    case "AAAA":
      return (rec.AAAA ?? []).map((data) => ({ name, type, data }));
    case "CNAME":
      return rec.CNAME ? [{ name, type, data: fqdn(rec.CNAME) }] : [];
    case "MX":
      return (rec.MX ?? []).map((m) => ({ name, type, data: `${m.pref} ${fqdn(m.host)}` }));
    case "NS":
      return (rec.NS ?? []).map((h) => ({ name, type, data: fqdn(h) }));
    case "TXT":
      return (rec.TXT ?? []).map((t) => ({ name, type, data: `"${t}"` }));
  }
}

/** Answer records for name/type, following CNAMEs like a recursive resolver. */
function answer(net: Network, qname: string, type: RrType): { status: "NOERROR" | "NXDOMAIN"; rrs: Rr[] } {
  const rrs: Rr[] = [];
  let current = normalizeName(qname);
  for (let i = 0; i < 6; i++) {
    const rec = Object.hasOwn(net.dns, current) ? net.dns[current] : undefined;
    if (!rec) return { status: rrs.length ? "NOERROR" : "NXDOMAIN", rrs };
    if (rec.CNAME && type !== "CNAME") {
      rrs.push({ name: fqdn(current), type: "CNAME", data: fqdn(rec.CNAME) });
      current = normalizeName(rec.CNAME);
      continue;
    }
    rrs.push(...recordsOf(rec, fqdn(current), type));
    return { status: "NOERROR", rrs };
  }
  return { status: "NOERROR", rrs };
}

/** Stable 5-digit query id for a question (real dig uses a random one). */
function queryId(q: string): number {
  let h = 5381;
  for (const c of q) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return 10000 + (h % 55536);
}

export const dig: Command = {
  name: "dig",
  summary: "ask DNS about a name: dig example.com, dig +short example.com MX",
  run(ctx) {
    const args = ctx.argv.slice(1);
    let server: string | undefined;
    let short = false;
    let type: RrType = "A";
    let name: string | undefined;
    for (const a of args) {
      if (a.startsWith("@")) server = a.slice(1);
      else if (a === "+short") short = true;
      else if (a.startsWith("+")) continue;
      else if ((TYPES as readonly string[]).includes(a.toUpperCase())) type = a.toUpperCase() as RrType;
      else name ??= a;
    }
    const net = ctx.network;
    if (!net) return { stdout: ";; connection timed out; no servers could be reached\n", stderr: "", code: 9 };
    const qname = name ?? ".";
    const { status, rrs } = answer(net, qname, type);

    if (short) return ok(rrs.map((r) => `${r.data}\n`).join(""));

    const srv = server ?? net.resolver;
    const lines = [
      `; <<>> DiG 9.18.28 <<>> ${args.join(" ")}`,
      ";; global options: +cmd",
      ";; Got answer:",
      `;; ->>HEADER<<- opcode: QUERY, status: ${status}, id: ${queryId(`${qname}/${type}`)}`,
      `;; flags: qr rd ra; QUERY: 1, ANSWER: ${rrs.length}, AUTHORITY: 0, ADDITIONAL: 1`,
      "",
      ";; OPT PSEUDOSECTION:",
      "; EDNS: version: 0, flags:; udp: 65494",
      ";; QUESTION SECTION:",
      `;${fqdn(qname)}\t\t\tIN\t${type}`,
      "",
    ];
    if (rrs.length) {
      lines.push(";; ANSWER SECTION:", ...rrs.map((r) => `${r.name}\t\t300\tIN\t${r.type}\t${r.data}`), "");
    }
    lines.push(
      ";; Query time: 4 msec",
      `;; SERVER: ${srv}#53(${srv}) (UDP)`,
      ";; WHEN: Wed Oct 07 10:00:00 IST 2026",
      `;; MSG SIZE  rcvd: ${40 + rrs.length * 16}`,
      "",
    );
    return ok(lines.join("\n") + "\n");
  },
};
