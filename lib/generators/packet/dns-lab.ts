import type { Generator } from "../index";
import { CaptureBuilder } from "./capture-builder";

/**
 * Rank 1 Networking Lab 5: DNS Investigation
 * Objectives:
 * o1: the domain that returned NXDOMAIN (nxdomain, case-insensitive)
 * o2: the IP that beacon.example resolved to (resolved)
 * o3: the host that sent the most DNS queries (chatty)
 */
export const dnsLab: Generator = (rng) => {
  const dnsServerIp = "10.0.2.3";
  const serverMac = "52:54:00:12:34:03";

  const clientIps = ["10.0.2.15", "10.0.2.16", "10.0.2.17", "10.0.2.18"];
  const chattyHost = rng.pick(clientIps);

  const resolvedIp = `203.0.113.${rng.int(10, 240)}`;
  const nxdomainDomain = `invalid-${rng.hex(4)}.corp.example`;

  const commonDomains = [
    "updates.example",
    "relay.example",
    "mail.example",
    "auth.example",
    "cloud.example",
    "ntp.example",
  ];

  const builder = new CaptureBuilder("dns-traffic.pcap");

  // Every name has one answer, whoever asks for it.
  const addressOf = new Map(commonDomains.map((d, i) => [d, `198.51.100.${20 + i}`]));
  addressOf.set("beacon.example", resolvedIp);
  // Each client is its own machine with its own network card.
  const macOf = new Map(clientIps.map((ip, i) => [ip, `52:54:00:12:34:${(0x56 + i).toString(16)}`]));

  // The chatty host asks 12–16 times, the others 2–4 times each; the order is shuffled,
  // so finding the chatty host means counting, not reading the first packet.
  const [nxClient] = rng.shuffle(clientIps.filter((c) => c !== chattyHost));
  const exchanges: { client: string; domain: string; nx: boolean }[] = [];
  for (const client of clientIps) {
    const count = client === chattyHost ? rng.int(12, 16) : rng.int(2, 4);
    for (let i = 0; i < count; i++) exchanges.push({ client, domain: rng.pick(commonDomains), nx: false });
  }
  const ordered = rng.shuffle(exchanges);
  ordered.find((e) => e.client === chattyHost)!.domain = "beacon.example";
  const nx = ordered.find((e) => e.client === nxClient)!;
  [nx.domain, nx.nx] = [nxdomainDomain, true];

  let txId = 0x1000;
  let clientPort = 53000;
  for (const { client, domain, nx: isNx } of ordered) {
    txId++;
    clientPort++;
    const mac = macOf.get(client)!;
    builder.addDnsQuery(client, dnsServerIp, mac, serverMac, domain, txId, clientPort);
    builder.addDnsResponse(
      client,
      dnsServerIp,
      mac,
      serverMac,
      domain,
      txId,
      isNx ? [] : [{ name: domain, type: "A", data: addressOf.get(domain)!, ttl: 300 }],
      isNx ? "NXDOMAIN" : "NOERROR",
      clientPort,
    );
  }

  const capture = builder.build();

  return {
    env: { kind: "packet", capture },
    answers: {
      nxdomain: nxdomainDomain,
      resolved: resolvedIp,
      chatty: chattyHost,
    },
  };
};
