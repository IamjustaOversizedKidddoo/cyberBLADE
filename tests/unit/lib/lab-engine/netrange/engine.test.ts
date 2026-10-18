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

    it("supports optional per-seed randomizationPoints in schema", () => {
      const scenarioWithPoints = {
        ...footholdScenario,
        randomizationPoints: {
          sshPort: 22,
          ftpBanner: "vsftpd 2.3.4",
          backdoorPort: 6200,
        },
      };
      const parsed = netRangeScenarioSchema.safeParse(scenarioWithPoints);
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

    it("fails linting when host has non-documentation or non-private IP", () => {
      const badIpScenario = {
        ...footholdScenario,
        hosts: [
          {
            ...footholdScenario.hosts[0],
            interfaces: [{ ip: "8.8.8.8", subnet: "192.0.2.0/24" }],
          },
        ],
      };
      const lintResult = lintNetRangeScenario(badIpScenario);
      expect(lintResult.valid).toBe(false);
      expect(lintResult.errors.some((e) => e.includes("Must be RFC 5737 or RFC 1918"))).toBe(true);
    });

    it("parses complex quoted argument vectors, flags with equal signs, and chains", () => {
      const argv = parseArgv('nmap -sV -p 21,22 "192.0.2.50" --script "banner,default"');
      expect(argv).toEqual(["nmap", "-sV", "-p", "21,22", "192.0.2.50", "--script", "banner,default"]);

      const singleQuote = parseArgv("smbclient //192.0.2.100/public -c 'get secret.txt'");
      expect(singleQuote).toEqual(["smbclient", "//192.0.2.100/public", "-c", "get secret.txt"]);

      const empty = parseArgv("   ");
      expect(empty).toEqual([]);
    });
  });

  describe("2. Reconnaissance & Discovery Tools", () => {
    it("nmap performs TCP port scan, version detection, and OS fingerprinting", () => {
      const state = createInitialNetRangeState(footholdScenario);

      // Aggressive scan with OS detection and service versions
      const res = execNetRangeCommand("nmap -sV -sC -O 192.0.2.50", state, footholdScenario);
      expect(res.code).toBe(0);
      expect(res.stdout).toContain("21/tcp");
      expect(res.stdout).toContain("vsftpd 2.3.4");
      expect(res.stdout).toContain("22/tcp");
      expect(res.stdout).toContain("OpenSSH");
      expect(res.stdout).toContain("80/tcp");
      expect(res.stdout).toContain("Running: Linux 5.X|4.X");
      expect(res.stdout).toContain("OS details: Linux 5.4 - 5.10");
    });

    it("nmap supports -sS stealth scan and port filtering", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("nmap -sS -p 21 192.0.2.50", state, footholdScenario);

      expect(res.code).toBe(0);
      expect(res.stdout).toContain("Scanning with SYN Stealth Scan");
      expect(res.stdout).toContain("21/tcp");
      expect(res.stdout).not.toContain("22/tcp");
    });

    it("nmap saves scan output using -oN to downloaded files", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("nmap -sV -p 21,80 -oN scan_output.txt 192.0.2.50", state, footholdScenario);

      expect(res.code).toBe(0);
      expect(res.nextState.downloadedFiles["scan_output.txt"]).toBeDefined();
      expect(res.nextState.downloadedFiles["scan_output.txt"]).toContain("vsftpd 2.3.4");

      // Verify file is readable with cat
      const catRes = execNetRangeCommand("cat scan_output.txt", res.nextState, footholdScenario);
      expect(catRes.stdout).toContain("vsftpd 2.3.4");
    });

    it("nmap handles CIDR subnet sweep and unroutable hosts", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const sweep = execNetRangeCommand("nmap -Pn 192.0.2.0/24", state, footholdScenario);
      expect(sweep.code).toBe(0);
      expect(sweep.stdout).toContain("Nmap scan report for apex-srv01 (192.0.2.50)");

      // Target outside routing table
      const unroutable = execNetRangeCommand("nmap 10.10.10.50", state, footholdScenario);
      expect(unroutable.stdout).toContain("Note: Host seems down");
    });

    it("gobuster enumerates directories and handles status codes", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("gobuster dir -u http://192.0.2.50/ -w common.txt", state, footholdScenario);

      expect(res.code).toBe(0);
      expect(res.stdout).toContain("Gobuster v3.6");
      expect(res.stdout).toContain("Starting gobuster directory enumeration");
    });

    it("ffuf performs web fuzzing over endpoints", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("ffuf -u http://192.0.2.50/FUZZ -w rockyou.txt", state, footholdScenario);

      expect(res.code).toBe(0);
      expect(res.stdout).toContain("v2.1.0-dev");
      expect(res.stdout).toContain(":: Method           : GET");
    });

    it("enum4linux and enum4linux-ng enumerate SMB users, shares, and domains", () => {
      const state = createInitialNetRangeState(footholdScenario);

      // Classic enum4linux
      const resClassic = execNetRangeCommand("enum4linux 192.0.2.50", state, footholdScenario);
      expect(resClassic.code).toBe(0);
      expect(resClassic.stdout).toContain("Starting enum4linux");
      expect(resClassic.stdout).toContain("Got domain/workgroup name: APEXCORP");

      // Modern enum4linux-ng
      const resNg = execNetRangeCommand("enum4linux-ng 192.0.2.50", state, footholdScenario);
      expect(resNg.code).toBe(0);
      expect(resNg.stdout).toContain("enum4linux-ng v1.3.1");
      expect(resNg.stdout).toContain("Workgroup/Domain: APEXCORP");
      expect(resNg.stdout).toContain("SMB Dialect:");
    });

    it("ftp connects, performs anonymous login, and retrieves files", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("ftp 192.0.2.50", state, footholdScenario);

      expect(res.code).toBe(0);
      expect(res.stdout).toContain("Connected to 192.0.2.50.");
      expect(res.stdout).toContain("230 Login successful.");
      expect(res.nextState.downloadedFiles["README.txt"]).toBeDefined();
    });

    it("curl queries HTTP endpoints, sets headers, and handles error states", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("curl -i http://192.0.2.50/", state, footholdScenario);

      expect(res.code).toBe(0);
      expect(res.stdout).toContain("HTTP/1.1 200 OK");
      expect(res.stdout).toContain("Apex Systems Portal");

      const notFound = execNetRangeCommand("curl -i http://192.0.2.50/nonexistent", state, footholdScenario);
      expect(notFound.stdout).toContain("404 Not Found");

      const postReq = execNetRangeCommand('curl -X POST -d "param=val" http://192.0.2.50/', state, footholdScenario);
      expect(postReq.code).toBe(0);
    });

    it("searchsploit locates exploits matching software versions", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const res = execNetRangeCommand("searchsploit vsftpd 2.3.4", state, footholdScenario);

      expect(res.code).toBe(0);
      expect(res.stdout).toContain("vsftpd 2.3.4 - Backdoor Command Execution");
      expect(res.stdout).toContain("unix/remote/17491.rb");

      const noRes = execNetRangeCommand("searchsploit unfindablesoftware999", state, footholdScenario);
      expect(noRes.stdout).toContain("Shellcodes: No Results");
    });
  });

  describe("3. Metasploit Exploitation & Host Session Management", () => {
    it("interacts with msfconsole search, use, set, run, and session management", () => {
      let state = createInitialNetRangeState(footholdScenario);

      // Launch msfconsole
      let res = execNetRangeCommand("msfconsole", state, footholdScenario);
      expect(res.stdout).toContain("metasploit v6.3.4-dev");
      state = res.nextState;

      // Search modules
      res = execNetRangeCommand("search vsftpd", state, footholdScenario);
      expect(res.stdout).toContain("Matching Modules");
      expect(res.stdout).toContain("exploit/unix/ftp/vsftpd_234_backdoor");
      state = res.nextState;

      // Select exploit
      res = execNetRangeCommand("use exploit/unix/ftp/vsftpd_234_backdoor", state, footholdScenario);
      expect(res.stdout).toContain("Using exploit/unix/ftp/vsftpd_234_backdoor");
      state = res.nextState;

      // Set target
      res = execNetRangeCommand("set RHOSTS 192.0.2.50", state, footholdScenario);
      expect(res.stdout).toContain("RHOSTS => 192.0.2.50");
      state = res.nextState;

      // Show options
      res = execNetRangeCommand("show options", state, footholdScenario);
      expect(res.stdout).toContain("Module options (exploit/unix/ftp/vsftpd_234_backdoor)");
      expect(res.stdout).toContain("192.0.2.50");
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

      const hostname = execNetRangeCommand("hostname", state, footholdScenario);
      expect(hostname.stdout.trim()).toBe("apex-srv01");

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

    it("executes host shell utilities and handles exit", () => {
      let state = createInitialNetRangeState(footholdScenario, {
        currentHostId: "apex-srv01",
        currentUser: "operator",
        currentCwd: "/home/operator",
      });

      const psRes = execNetRangeCommand("ps", state, footholdScenario);
      expect(psRes.stdout).toContain("vsftpd");

      const netstatRes = execNetRangeCommand("netstat", state, footholdScenario);
      expect(netstatRes.stdout).toContain("0.0.0.0:21");

      const echoRes = execNetRangeCommand("echo hello world", state, footholdScenario);
      expect(echoRes.stdout).toBe("hello world\n");

      // Exit back to attacker shell
      const exitRes = execNetRangeCommand("exit", state, footholdScenario);
      expect(exitRes.stdout).toContain("Connection to apex-srv01 closed.");
      state = exitRes.nextState;
      expect(state.currentHostId).toBeNull();
      expect(state.currentUser).toBe("kali");
    });
  });

  describe("4. Password Recovery: John & Hashcat", () => {
    const webCredLab = netrangeWebCredReuse(rng, {});
    const webCredScenario = (webCredLab.env as { network: { scenario: NetRangeScenario } }).network.scenario;

    it("john cracks hashes using bundled wordlist", () => {
      const state = createInitialNetRangeState(webCredScenario);
      const res = execNetRangeCommand("john --wordlist=rockyou.txt hashes.txt", state, webCredScenario);

      expect(res.code).toBe(0);
      expect(res.stdout).toContain("Loaded");
      expect(res.stdout).toContain("DONE");

      const show = execNetRangeCommand("john --show hashes.txt", res.nextState, webCredScenario);
      expect(show.code).toBe(0);
      expect(show.stdout).toContain("password hash");
    });

    it("hashcat supports mode 0 (MD5) and mode 1000 (NTLM) dictionary attacks", () => {
      const state = createInitialNetRangeState(webCredScenario);
      const res = execNetRangeCommand("hashcat -m 0 -a 0 hashes.txt rockyou.txt", state, webCredScenario);

      expect(res.code).toBe(0);
      expect(res.stdout).toContain("hashcat (v6.2.6) starting");
      expect(res.stdout).toContain("Status...........: Cracked");
      expect(res.nextState.crackedHashes).toBeDefined();

      const show = execNetRangeCommand("hashcat --show -m 0 hashes.txt", res.nextState, webCredScenario);
      expect(show.code).toBe(0);
      expect(show.stdout.length).toBeGreaterThan(0);
    });
  });

  describe("5. Lateral Movement, Pivoting & Proxychains", () => {
    const pivotLab = netrangePivotInternal(rng, {});
    const pivotScenario = (pivotLab.env as { network: { scenario: NetRangeScenario } }).network.scenario;

    it("blocks direct access to internal subnet prior to routing configuration", () => {
      const state = createInitialNetRangeState(pivotScenario);
      const ping = execNetRangeCommand("ping 172.16.50.25", state, pivotScenario);

      expect(ping.code).toBe(1);
      expect(ping.stdout).toContain("Destination Host Unreachable");
    });

    it("establishes dynamic SOCKS proxy with ssh -D and routes via proxychains", () => {
      let state = createInitialNetRangeState(pivotScenario);

      // Establish background SSH dynamic SOCKS proxy
      const sshD = execNetRangeCommand("ssh -D 1080 -f -N pivotuser@192.0.2.100", state, pivotScenario);
      expect(sshD.code).toBe(0);
      expect(sshD.stdout).toContain("Dynamic SOCKS proxy established on 127.0.0.1:1080");
      state = sshD.nextState;

      // Proxychains now successfully connects to internal target
      const proxyCurl = execNetRangeCommand("proxychains curl http://172.16.50.25:8080/api/crown_jewel", state, pivotScenario);
      expect(proxyCurl.code).toBe(0);
      expect(proxyCurl.stdout).toContain("[proxychains] preloading /usr/lib/libproxychains4.so");
      expect(proxyCurl.stdout).toContain("Dynamic chain  ...  127.0.0.1:1080");
      expect(proxyCurl.stdout).toContain("OK");
      expect(proxyCurl.stdout).toContain("TOP_SECRET");
    });

    it("proxychains fails cleanly when no SOCKS tunnel or pivot exists", () => {
      const state = createInitialNetRangeState(pivotScenario);
      const failRes = execNetRangeCommand("proxychains curl http://172.16.50.25:8080/", state, pivotScenario);

      expect(failRes.code).toBe(1);
      expect(failRes.stderr).toContain("Could not connect to SOCKS4/5 proxy");
    });

    it("supports ip route and route add for internal subnet discovery", () => {
      let state = createInitialNetRangeState(pivotScenario);
      // Simulate compromising host first to satisfy pivot rule
      state = execNetRangeCommand("smbclient //192.0.2.100/public -c 'get creds.txt'", state, pivotScenario).nextState;

      const ipRouteAdd = execNetRangeCommand("ip route add 172.16.50.0/24 via 192.0.2.100", state, pivotScenario);
      expect(ipRouteAdd.code).toBe(0);
      expect(ipRouteAdd.stdout).toContain("Route added for 172.16.50.0/24 via 192.0.2.100");
      state = ipRouteAdd.nextState;

      // Inspect route table
      const ipRouteShow = execNetRangeCommand("ip route show", state, pivotScenario);
      expect(ipRouteShow.stdout).toContain("172.16.50.0");
    });
  });

  describe("6. Determinism, Flag Non-Leakage & Performance Gates", () => {
    it("generates deterministic flags for same seed and distinct flags for different seeds", () => {
      const seed1 = "static-seed-9999";
      const seed2 = "static-seed-8888";

      const a1 = netrangeFootholdPrivesc(createRng(seed1), {});
      const a2 = netrangeFootholdPrivesc(createRng(seed1), {});
      const a3 = netrangeFootholdPrivesc(createRng(seed2), {});

      expect(a1.answers).toEqual(a2.answers);
      expect(a1.answers.flag_foothold).not.toEqual(a3.answers.flag_foothold);
    });

    it("ensures flags never leak in initial client state or unknown command responses", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const serialized = JSON.stringify(state);

      // Secret flag substrings should never be in state
      expect(serialized).not.toContain("PENTEST{foothold_");
      expect(serialized).not.toContain("PENTEST{root_privesc_");

      // Unknown command error never leaks flags
      const err = execNetRangeCommand("fake_command_xyz", state, footholdScenario);
      expect(err.stderr).not.toContain("PENTEST{");
    });

    it("executes all commands well within the 150ms performance threshold", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const testCommands = [
        "nmap 192.0.2.50",
        "searchsploit vsftpd",
        "gobuster dir -u http://192.0.2.50/ -w common.txt",
        "ffuf -u http://192.0.2.50/FUZZ -w rockyou.txt",
        "enum4linux-ng 192.0.2.50",
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

    it("properly handles submit command with flag and objective target", () => {
      const state = createInitialNetRangeState(footholdScenario);

      const res1 = execNetRangeCommand("submit 1 PENTEST{foothold_12345678}", state, footholdScenario);
      expect(res1.code).toBe(0);
      expect(res1.submit).toEqual({ objective: 1, answer: "PENTEST{foothold_12345678}" });

      const res2 = execNetRangeCommand("submit PENTEST{foothold_12345678}", state, footholdScenario);
      expect(res2.code).toBe(0);
      expect(res2.submit?.answer).toBe("PENTEST{foothold_12345678}");
    });

    it("supports command chaining with && and ;", () => {
      const state = createInitialNetRangeState(footholdScenario);
      const chained = execNetRangeCommand("whoami && id", state, footholdScenario);

      expect(chained.code).toBe(0);
      expect(chained.stdout).toContain("kali");
      expect(chained.stdout).toContain("uid=1000(kali)");

      const stopped = execNetRangeCommand("nonexistent_command && whoami", state, footholdScenario);
      expect(stopped.code).toBe(127);
      expect(stopped.stdout).not.toContain("kali");
    });
  });

  describe("7. Attacker Environment & Windows Shell Emulation", () => {
    it("handles attacker terminal helper commands (clear, history, ifconfig, ping)", () => {
      let state = createInitialNetRangeState(footholdScenario);
      state = execNetRangeCommand("whoami", state, footholdScenario).nextState;

      const clearRes = execNetRangeCommand("clear", state, footholdScenario);
      expect(clearRes.stdout).toBe("\x1b[2J\x1b[3J\x1b[H");

      const historyRes = execNetRangeCommand("history", state, footholdScenario);
      expect(historyRes.stdout).toContain("whoami");

      const ifconfigRes = execNetRangeCommand("ifconfig", state, footholdScenario);
      expect(ifconfigRes.stdout).toContain("192.0.2.200");

      const pingRoutable = execNetRangeCommand("ping 192.0.2.50", state, footholdScenario);
      expect(pingRoutable.code).toBe(0);
      expect(pingRoutable.stdout).toContain("0% packet loss");

      const pingUnroutable = execNetRangeCommand("ping 10.99.99.1", state, footholdScenario);
      expect(pingUnroutable.code).toBe(1);
      expect(pingUnroutable.stdout).toContain("Destination Host Unreachable");
    });

    it("emulates Windows remote shell commands", () => {
      const winScenario: NetRangeScenario = {
        ...footholdScenario,
        hosts: [
          {
            ...footholdScenario.hosts[0],
            os: "windows",
            hostname: "WIN-SRV01",
            users: [
              { username: "Administrator", role: "administrator" },
              { username: "operator", password: "operatorPass123", role: "user" },
            ],
            filesystem: {
              "C:\\Users\\Administrator\\flag.txt": {
                content: "PENTEST{win_admin_flag}\n",
                owner: "Administrator",
              },
            },
          },
        ],
      };

      const winState = createInitialNetRangeState(winScenario, {
        currentHostId: "apex-srv01",
        currentUser: "Administrator",
        currentCwd: "C:\\Users\\Administrator",
      });

      const ipconfig = execNetRangeCommand("ipconfig", winState, winScenario);
      expect(ipconfig.stdout).toContain("Windows IP Configuration");

      const netUser = execNetRangeCommand("net user", winState, winScenario);
      expect(netUser.stdout).toContain("User accounts for \\\\WIN-SRV01");
      expect(netUser.stdout).toContain("Administrator");

      const tasklist = execNetRangeCommand("tasklist", winState, winScenario);
      expect(tasklist.stdout).toContain("services.exe");

      const dirRes = execNetRangeCommand("dir", winState, winScenario);
      expect(dirRes.code).toBe(0);

      const typeRes = execNetRangeCommand("type flag.txt", winState, winScenario);
      expect(typeRes.stdout).toContain("PENTEST{win_admin_flag}");

      const unameFail = execNetRangeCommand("uname", winState, winScenario);
      expect(unameFail.code).toBe(1);
      expect(unameFail.stderr).toContain("'uname' is not recognized as an internal or external command");
    });
  });
});
