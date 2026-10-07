import type { Generator } from "../index";
import { CaptureBuilder } from "./capture-builder";

/**
 * Rank 1 Networking Lab 4: Port Scan Analysis
 * Objectives:
 * o1: the scanning IP (scanner)
 * o2: open ports found, ascending comma-separated (openPorts, e.g. "22,80,443")
 * o3: number of ports probed (probed)
 */
export const scanLab: Generator = (rng) => {
  const scannerIp = `198.51.100.${rng.int(10, 240)}`;
  const targetIp = `10.0.2.${rng.int(15, 25)}`;
  const scannerMac = "00:1a:2b:3c:4d:5e";
  const targetMac = "52:54:00:12:34:56";

  const allCandidatePorts = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 993, 995, 3306, 3389, 5432, 8080, 8443];
  const probedPorts = rng.shuffle(allCandidatePorts).slice(0, rng.int(10, 16));
  const probedCount = probedPorts.length;

  const openPortCandidates = [22, 80, 443, 8080].filter((p) => probedPorts.includes(p));
  const openPortsList = openPortCandidates.length >= 2
    ? openPortCandidates.slice(0, rng.int(2, 3)).sort((a, b) => a - b)
    : [22, 80].filter((p) => probedPorts.includes(p)).sort((a, b) => a - b);

  if (openPortsList.length === 0) {
    openPortsList.push(probedPorts[0]);
    openPortsList.sort((a, b) => a - b);
  }

  const builder = new CaptureBuilder("port-scan.pcap");

  // Background noise: ARP pair
  builder.addArpPair(targetIp, "10.0.2.1", targetMac, "52:55:0a:00:02:02");

  // Probes in sequence
  let clientEphemeralPort = 40000;
  for (const port of probedPorts) {
    clientEphemeralPort++;
    const isOpen = openPortsList.includes(port);
    if (isOpen) {
      builder.addTcpHandshake(scannerIp, targetIp, scannerMac, targetMac, clientEphemeralPort, port, 0.005);
    } else {
      builder.addTcpProbeClosed(scannerIp, targetIp, scannerMac, targetMac, clientEphemeralPort, port, 0.005);
    }
  }

  const capture = builder.build();

  return {
    env: { kind: "packet", capture },
    answers: {
      scanner: scannerIp,
      openPorts: openPortsList.join(","),
      probed: String(probedCount),
    },
  };
};
