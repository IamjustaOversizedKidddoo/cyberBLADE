import { netRun } from "../fixture-network";

test("ss -tln lists listening TCP sockets with padded columns", () => {
  expect(netRun("ss -tln").stdout).toBe(
    [
      "State  Recv-Q Send-Q Local Address:Port Peer Address:Port",
      "LISTEN 0      128          0.0.0.0:22        0.0.0.0:*",
      "LISTEN 0      4096   127.0.0.53%lo:53        0.0.0.0:*",
      "",
    ].join("\n"),
  );
});

test("-p adds the owning process; -u lists UDP; both add Netid", () => {
  const out = netRun("ss -tulnp").stdout.split("\n");
  expect(out[0]).toBe("Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process");
  expect(out).toContain('tcp   LISTEN 0      128          0.0.0.0:22        0.0.0.0:*    users:(("sshd",pid=812,fd=3))');
  expect(out.some((l) => l.startsWith("udp   UNCONN 0      0      127.0.0.53%lo:53"))).toBe(true);
});

test("without -l there are no established connections in the lab", () => {
  expect(netRun("ss -tn").stdout).toBe("State Recv-Q Send-Q Local Address:Port Peer Address:Port\n");
});
