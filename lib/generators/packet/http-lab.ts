import type { Generator } from "../index";
import { formatFlag } from "../flag";
import { CaptureBuilder } from "./capture-builder";

/**
 * Rank 1 Networking Lab 6: HTTP and TLS Capture Analysis
 * Objectives:
 * o1: the username sent in the plain-HTTP login (username, case-sensitive)
 * o2: the flag in the server's reply (flag)
 * o3: the TLS server name (SNI) contacted right after (sni, case-insensitive)
 */
export const httpLab: Generator = (rng) => {
  const clientIp = "10.0.2.15";
  const webServerIp = "203.0.113.80";
  const tlsServerIp = "198.51.100.44";
  const clientMac = "52:54:00:12:34:56";
  const gatewayMac = "52:55:0a:00:02:02";

  const usernames = ["admin", "secops", "developer", "operator", "auditor", "sysadmin"];
  const username = rng.pick(usernames);
  const password = `Pass-${rng.hex(6)}!`;
  const flag = formatFlag(rng.hex(12));
  const sni = `vault-${rng.hex(4)}.secure.example`;

  const builder = new CaptureBuilder("http-session.pcap");

  // Step 1: Handshake with HTTP server
  const httpPort = 51520;
  builder.addTcpHandshake(clientIp, webServerIp, clientMac, gatewayMac, httpPort, 80, 0.005);

  // Step 2: POST /login and 200 response
  builder.addHttpExchange(
    clientIp,
    webServerIp,
    clientMac,
    gatewayMac,
    httpPort,
    80,
    {
      method: "POST",
      uri: "/login",
      host: "portal.example",
      headers: [
        ["Host", "portal.example"],
        ["Content-Type", "application/x-www-form-urlencoded"],
      ],
      body: `username=${username}&password=${password}`,
    },
    {
      code: 200,
      phrase: "OK",
      headers: [
        ["Server", "nginx/1.24.0"],
        ["Content-Type", "text/html"],
      ],
      body: `<h1>Login Successful</h1>\n<p>Welcome, ${username}. Your session authorization flag is ${flag}</p>\n`,
    },
    0.01,
  );

  // Step 3: Immediately contact TLS server
  const tlsPort = 51522;
  builder.addTcpHandshake(clientIp, tlsServerIp, clientMac, gatewayMac, tlsPort, 443, 0.005);
  builder.addTlsClientHello(clientIp, tlsServerIp, clientMac, gatewayMac, tlsPort, 443, sni, 0.005);

  const capture = builder.build();

  return {
    env: { kind: "packet", capture },
    answers: {
      username,
      flag,
      sni,
    },
  };
};
