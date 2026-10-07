import type { Command } from "./types";
import { fail, ok, parseFlags } from "./util";

/** iproute2 `ss` subset: listening sockets (-l) for TCP (-t) / UDP (-u), numeric (-n), processes (-p). */
export const ss: Command = {
  name: "ss",
  summary: "list open network ports: ss -tlnp (TCP), ss -ulnp (UDP)",
  run(ctx) {
    const { flags, bad } = parseFlags(ctx.argv.slice(1), "tulnpa");
    if (bad) return fail(`ss: invalid option -- '${bad}'\n`);
    const protos = (["tcp", "udp"] as const).filter((p) => flags.has(p[0]) || (!flags.has("t") && !flags.has("u")));
    const listening = flags.has("l") || flags.has("a");
    const rows = listening ? (ctx.network?.listening ?? []).filter((l) => protos.includes(l.proto)) : [];

    const netid = protos.length > 1;
    const proc = flags.has("p");
    const state = (p: string) => (p === "tcp" ? "LISTEN" : "UNCONN");
    const sendQ = (l: (typeof rows)[number]) => (l.proto === "tcp" ? String(l.backlog ?? 128) : "0");

    const w = {
      state: Math.max(5, ...rows.map((r) => state(r.proto).length)),
      localAddr: Math.max(13, ...rows.map((r) => r.addr.length)),
      localPort: Math.max(4, ...rows.map((r) => String(r.port).length)),
      peerAddr: Math.max(12, ...rows.map(() => "0.0.0.0".length)),
    };
    const line = (cells: { netid: string; state: string; recv: string; send: string; la: string; lp: string; pa: string; pp: string; process: string }) =>
      [
        netid ? cells.netid.padEnd(5) : null,
        cells.state.padEnd(w.state),
        cells.recv.padEnd(6),
        cells.send.padEnd(6),
        `${cells.la.padStart(w.localAddr)}:${cells.lp.padEnd(w.localPort)}`,
        `${cells.pa.padStart(w.peerAddr)}:${cells.pp.padEnd(4)}`,
        proc ? cells.process : null,
      ]
        .filter((c) => c !== null)
        .join(" ")
        .trimEnd();

    const header = line({ netid: "Netid", state: "State", recv: "Recv-Q", send: "Send-Q", la: "Local Address", lp: "Port", pa: "Peer Address", pp: "Port", process: "Process" });
    const body = rows.map((r) =>
      line({
        netid: r.proto,
        state: state(r.proto),
        recv: "0",
        send: sendQ(r),
        la: r.addr,
        lp: String(r.port),
        pa: "0.0.0.0",
        pp: "*",
        process: r.process ? `users:(("${r.process}",pid=${r.pid ?? 1},fd=3))` : "",
      }),
    );
    return ok([header, ...body].map((l) => `${l}\n`).join(""));
  },
};
