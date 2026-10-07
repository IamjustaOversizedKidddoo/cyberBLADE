import { createShell } from "@/lib/lab-engine/terminal/shell";
import { fixtureWorld } from "../fixture-world";
import { netRun } from "../fixture-network";

test("+short prints just the data", () => {
  expect(netRun("dig +short example.com").stdout).toBe("203.0.113.10\n");
  expect(netRun("dig +short www.example.com").stdout).toBe("example.com.\n203.0.113.10\n");
  expect(netRun("dig +short example.com MX").stdout).toBe("10 mail.example.com.\n");
  expect(netRun("dig example.com NS +short").stdout).toBe("ns1.example.com.\n");
  expect(netRun("dig +short nosuch.example").stdout).toBe("");
});

test("full answer follows the BIND 9.18 layout", () => {
  const out = netRun("dig www.example.com").stdout;
  const lines = out.split("\n");
  expect(lines[0]).toBe("; <<>> DiG 9.18.28 <<>> www.example.com");
  expect(lines[1]).toBe(";; global options: +cmd");
  expect(lines[2]).toBe(";; Got answer:");
  expect(lines[3]).toMatch(/^;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: \d{5}$/);
  expect(lines[4]).toBe(";; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1");
  expect(out).toContain(";; QUESTION SECTION:\n;www.example.com.\t\t\tIN\tA\n");
  expect(out).toContain(
    ";; ANSWER SECTION:\nwww.example.com.\t\t300\tIN\tCNAME\texample.com.\nexample.com.\t\t300\tIN\tA\t203.0.113.10\n",
  );
  expect(out).toContain(";; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)\n");
  expect(out).toContain(";; Query time: 4 msec\n");
});

test("the id is stable for the same question", () => {
  expect(netRun("dig example.com").stdout).toBe(netRun("dig example.com").stdout);
});

test("NXDOMAIN", () => {
  const out = netRun("dig nosuch.example").stdout;
  expect(out).toMatch(/status: NXDOMAIN, id: \d{5}/);
  expect(out).toContain("ANSWER: 0, AUTHORITY: 0");
  expect(out).not.toContain(";; ANSWER SECTION:");
});

test("@server is shown in the SERVER line", () => {
  expect(netRun("dig @10.0.2.2 example.com").stdout).toContain(";; SERVER: 10.0.2.2#53(10.0.2.2) (UDP)\n");
});

test("no network", () => {
  expect(createShell(fixtureWorld()).exec("dig example.com")).toEqual({
    stdout: ";; connection timed out; no servers could be reached\n",
    stderr: "",
    code: 9,
  });
});
