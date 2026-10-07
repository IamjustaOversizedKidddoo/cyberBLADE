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

  let txId = 0x1000;
  let clientPort = 53000;

  // Add queries from chatty host (around 12-16 queries)
  const chattyQueryCount = rng.int(12, 16);
  for (let i = 0; i < chattyQueryCount; i++) {
    txId++;
    clientPort++;
    const domain = i === 0 ? "beacon.example" : rng.pick(commonDomains);
    builder.addDnsQuery(chattyHost, dnsServerIp, "52:54:00:12:34:56", serverMac, domain, txId, clientPort);
    builder.addDnsResponse(
      chattyHost,
      dnsServerIp,
      "52:54:00:12:34:56",
      serverMac,
      domain,
      txId,
      [{ name: domain, type: "A", data: domain === "beacon.example" ? resolvedIp : "198.51.100.10", ttl: 300 }],
      "NOERROR",
      clientPort,
    );
  }

  // Add queries from other hosts (2-4 queries each)
  for (const client of clientIps) {
    if (client === chattyHost) continue;
    const count = rng.int(2, 4);
    for (let i = 0; i < count; i++) {
      txId++;
      clientPort++;
      const isNxdomain = client === clientIps.find((c) => c !== chattyHost) && i === 0;
      const domain = isNxdomain ? nxdomainDomain : rng.pick(commonDomains);
      const rcode = isNxdomain ? "NXDOMAIN" : "NOERROR";

      builder.addDnsQuery(client, dnsServerIp, "52:54:00:12:34:99", serverMac, domain, txId, clientPort);
      builder.addDnsResponse(
        client,
        dnsServerIp,
        "52:54:00:12:34:99",
        serverMac,
        domain,
        txId,
        isNxdomain ? [] : [{ name: domain, type: "A", data: "198.51.100.20", ttl: 300 }],
        rcode,
        clientPort,
      );
    }
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
