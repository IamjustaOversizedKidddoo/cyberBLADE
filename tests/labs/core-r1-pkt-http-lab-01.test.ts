import { describe, expect, it } from "vitest";
import { compileFilter } from "@/lib/lab-engine/packet/filter";
import { followTcpStream } from "@/lib/lab-engine/packet/stream";
import { FLAG, openPacketLab, SEEDS } from "./helpers";

describe("core-r1-pkt-http-lab-01", () => {
  it.each(SEEDS)("solves lab with seed %s using Wireshark filters and TCP follow stream", async (seed) => {
    const { capture, check } = await openPacketLab("core-r1-pkt-http-lab-01", seed);

    // o1: find the HTTP POST request
    const postFilter = compileFilter('http.request.method == "POST"');
    expect(postFilter.ok).toBe(true);
    if (!postFilter.ok) return;

    const postPacket = capture.packets.find(postFilter.test);
    expect(postPacket).toBeDefined();

    // Follow TCP stream to inspect conversation
    const stream = followTcpStream(capture.packets, postPacket!.no);
    expect(stream).not.toBeNull();
    const streamText = stream!.text;

    // o1: username from POST body
    const userMatch = streamText.match(/username=([^&]+)/);
    expect(userMatch).not.toBeNull();
    const username = userMatch![1];
    expect(check("o1", username)).toBe(true);

    // o2: flag from server reply
    const flagMatch = streamText.match(FLAG);
    expect(flagMatch).not.toBeNull();
    const flag = flagMatch![0];
    expect(check("o2", flag)).toBe(true);

    // o3: TLS server name (SNI) contacted right after
    const tlsFilter = compileFilter("tls.handshake.extensions_server_name");
    expect(tlsFilter.ok).toBe(true);
    if (!tlsFilter.ok) return;

    const tlsPacket = capture.packets.find(tlsFilter.test);
    expect(tlsPacket).toBeDefined();
    const sni = tlsPacket!.tls?.sni;
    expect(sni).toBeDefined();
    expect(check("o3", sni!)).toBe(true);
    // Review Focus #4: case-insensitive check
    expect(check("o3", sni!.toUpperCase())).toBe(true);
  });
});
