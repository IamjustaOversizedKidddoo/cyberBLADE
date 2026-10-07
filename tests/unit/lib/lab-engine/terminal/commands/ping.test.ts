import { createShell } from "@/lib/lab-engine/terminal/shell";
import { fixtureWorld } from "../fixture-world";
import { netRun } from "../fixture-network";

test("ping a name: iputils format with statistics", () => {
  expect(netRun("ping -c 3 example.com")).toEqual({
    stdout: [
      "PING example.com (203.0.113.10) 56(84) bytes of data.",
      "64 bytes from example.com (203.0.113.10): icmp_seq=1 ttl=56 time=12.3 ms",
      "64 bytes from example.com (203.0.113.10): icmp_seq=2 ttl=56 time=12.4 ms",
      "64 bytes from example.com (203.0.113.10): icmp_seq=3 ttl=56 time=12.5 ms",
      "",
      "--- example.com ping statistics ---",
      "3 packets transmitted, 3 received, 0% packet loss, time 2004ms",
      "rtt min/avg/max/mdev = 12.300/12.400/12.500/0.082 ms",
      "",
    ].join("\n"),
    stderr: "",
    code: 0,
  });
});

test("ping an address prints the bare address", () => {
  expect(netRun("ping -c 1 203.0.113.10").stdout).toContain("64 bytes from 203.0.113.10: icmp_seq=1 ttl=56 time=12.3 ms\n");
  expect(netRun("ping -c 1 203.0.113.10").stdout).toContain("1 packets transmitted, 1 received, 0% packet loss, time 0ms\n");
});

test("-c can be attached (-c2) or come after the host", () => {
  expect(netRun("ping -c2 example.com").stdout).toContain("2 packets transmitted");
  expect(netRun("ping example.com -c 2").stdout).toContain("2 packets transmitted");
});

test("unreachable host", () => {
  expect(netRun("ping -c 2 dead.example.net")).toEqual({
    stdout: [
      "PING dead.example.net (198.51.100.99) 56(84) bytes of data.",
      "From 10.0.2.15 icmp_seq=1 Destination Host Unreachable",
      "From 10.0.2.15 icmp_seq=2 Destination Host Unreachable",
      "",
      "--- dead.example.net ping statistics ---",
      "2 packets transmitted, 0 received, +2 errors, 100% packet loss, time 1004ms",
      "",
    ].join("\n"),
    stderr: "",
    code: 1,
  });
});

test("unknown name", () => {
  expect(netRun("ping -c 1 nosuch.example")).toEqual({ stdout: "", stderr: "ping: nosuch.example: Name or service not known\n", code: 2 });
});

test("without -c it explains instead of running forever", () => {
  expect(netRun("ping example.com")).toEqual({
    stdout: "",
    stderr: "ping: this lab needs -c <count> — real ping keeps going until you press Ctrl+C\n",
    code: 2,
  });
});

test("count must be 1–10", () => {
  expect(netRun("ping -c 50 example.com").code).toBe(2);
  expect(netRun("ping -c x example.com").code).toBe(2);
});

test("loopback always answers", () => {
  expect(netRun("ping -c 1 127.0.0.1").stdout).toContain("64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.0");
});

test("no network at all", () => {
  expect(createShell(fixtureWorld()).exec("ping -c 1 203.0.113.10")).toEqual({
    stdout: "",
    stderr: "ping: connect: Network is unreachable\n",
    code: 2,
  });
});
