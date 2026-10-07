import { netRun } from "../fixture-network";

test("hops to a reachable host, with a silent router", () => {
  expect(netRun("traceroute example.com").stdout).toBe(
    [
      "traceroute to example.com (203.0.113.10), 30 hops max, 60 byte packets",
      " 1  _gateway (10.0.2.2)  0.412 ms  0.398 ms  0.381 ms",
      " 2  * * *",
      " 3  198.51.100.1 (198.51.100.1)  9.225 ms  9.325 ms  9.425 ms",
      " 4  example.com (203.0.113.10)  12.300 ms  12.400 ms  12.500 ms",
      "",
    ].join("\n"),
  );
});

test("a host on the local subnet is one hop", () => {
  expect(netRun("traceroute 10.0.2.50").stdout.split("\n")).toEqual([
    "traceroute to 10.0.2.50 (10.0.2.50), 30 hops max, 60 byte packets",
    " 1  intranet.corp.example (10.0.2.50)  0.800 ms  0.900 ms  1.000 ms",
    "",
  ]);
});

test("an unreachable host runs out to 30 hops", () => {
  const lines = netRun("traceroute dead.example.net").stdout.trim().split("\n");
  expect(lines).toHaveLength(31);
  expect(lines[2]).toBe(" 2  198.51.100.1 (198.51.100.1)  5.100 ms  5.200 ms  5.300 ms");
  expect(lines[30]).toBe("30  * * *");
});

test("unknown name", () => {
  expect(netRun("traceroute nosuch.example")).toMatchObject({
    stderr: "nosuch.example: Name or service not known\nCannot handle \"host\" cmdline arg `nosuch.example' on position 1 (argc 1)\n",
    code: 2,
  });
});
