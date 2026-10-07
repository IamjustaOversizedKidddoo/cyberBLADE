import { describe, expect, it } from "vitest";
import { followTcpStream } from "@/lib/lab-engine/packet/stream";
import { FIXTURE_CAPTURE } from "./fixture-capture";

describe("followTcpStream", () => {
  it("returns null for non-TCP packets", () => {
    expect(followTcpStream(FIXTURE_CAPTURE.packets, 1)).toBeNull(); // ARP
    expect(followTcpStream(FIXTURE_CAPTURE.packets, 3)).toBeNull(); // DNS (UDP)
    expect(followTcpStream(FIXTURE_CAPTURE.packets, 12)).toBeNull(); // ICMP
  });

  it("follows TCP conversation and returns client, server, and full payload text", () => {
    // Packet 8 is the HTTP POST inside the stream between 10.0.2.15:51514 and 203.0.113.10:80
    const stream = followTcpStream(FIXTURE_CAPTURE.packets, 8);
    expect(stream).not.toBeNull();
    expect(stream?.client).toBe("10.0.2.15:51514");
    expect(stream?.server).toBe("203.0.113.10:80");
    expect(stream?.text).toContain("POST /login HTTP/1.1");
    expect(stream?.text).toContain("username=admin&password=secretpassword");
    expect(stream?.text).toContain("HTTP/1.1 200 OK");
    expect(stream?.text).toContain("<h1>Welcome</h1>");
  });

  it("produces identical conversation when called from server packet", () => {
    const streamFromClient = followTcpStream(FIXTURE_CAPTURE.packets, 8);
    const streamFromServer = followTcpStream(FIXTURE_CAPTURE.packets, 9);
    expect(streamFromServer).toEqual(streamFromClient);
  });
});
