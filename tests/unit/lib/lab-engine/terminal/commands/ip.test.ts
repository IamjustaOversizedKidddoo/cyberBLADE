import { createShell } from "@/lib/lab-engine/terminal/shell";
import { fixtureWorld } from "../fixture-world";
import { netRun } from "../fixture-network";

const LO = [
  "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000",
  "    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00",
  "    inet 127.0.0.1/8 scope host lo",
  "       valid_lft forever preferred_lft forever",
];

test("ip addr lists loopback and every interface in iproute2 format", () => {
  expect(netRun("ip addr").stdout).toBe(
    [
      ...LO,
      "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000",
      "    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff",
      "    inet 10.0.2.15/24 brd 10.0.2.255 scope global dynamic eth0",
      "       valid_lft 86313sec preferred_lft 86313sec",
      "    inet6 fe80::5054:ff:fe12:3456/64 scope link",
      "       valid_lft forever preferred_lft forever",
      "3: eth1: <BROADCAST,MULTICAST> mtu 1500 qdisc noop state DOWN group default qlen 1000",
      "    link/ether 52:54:00:ab:cd:ef brd ff:ff:ff:ff:ff:ff",
      "",
    ].join("\n"),
  );
});

test("ip a and ip address show are the same", () => {
  expect(netRun("ip a").stdout).toBe(netRun("ip addr").stdout);
  expect(netRun("ip address show").stdout).toBe(netRun("ip addr").stdout);
});

test("ip route shows the default route and the local subnet", () => {
  expect(netRun("ip route").stdout).toBe(
    "default via 10.0.2.2 dev eth0 proto dhcp src 10.0.2.15 metric 100\n" +
      "10.0.2.0/24 dev eth0 proto kernel scope link src 10.0.2.15 metric 100\n",
  );
});

test("ip neigh shows the gateway's MAC", () => {
  expect(netRun("ip neigh").stdout).toBe("10.0.2.2 dev eth0 lladdr 52:55:0a:00:02:02 REACHABLE\n");
});

test("unknown object", () => {
  expect(netRun("ip banana")).toEqual({ stdout: "", stderr: 'Object "banana" is unknown, try "ip help".\n', code: 1 });
});

test("a machine with no network shows only loopback", () => {
  expect(createShell(fixtureWorld()).exec("ip a").stdout).toBe(LO.join("\n") + "\n");
});
