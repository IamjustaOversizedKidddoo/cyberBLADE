import type { NetRangeScenario } from "../types";

export type ExploitEntry = {
  title: string;
  path: string;
  cve?: string;
  type: string;
  platform: string;
};

const COMMON_EXPLOITS: ExploitEntry[] = [
  {
    title: "vsftpd 2.3.4 - Backdoor Command Execution",
    path: "unix/remote/17491.rb",
    cve: "CVE-2011-2523",
    type: "remote",
    platform: "unix",
  },
  {
    title: "vsftpd 2.3.4 - Backdoor Command Execution (Python)",
    path: "unix/remote/49757.py",
    cve: "CVE-2011-2523",
    type: "remote",
    platform: "unix",
  },
  {
    title: "Samba 3.0.20 < 3.0.25rc3 - 'Username' map script' Command Execution",
    path: "unix/remote/16320.rb",
    cve: "CVE-2007-2447",
    type: "remote",
    platform: "unix",
  },
  {
    title: "Apache 2.4.49/2.4.50 - Path Traversal & Remote Code Execution",
    path: "multiple/remote/50383.sh",
    cve: "CVE-2021-41773",
    type: "remote",
    platform: "multiple",
  },
  {
    title: "Linux SUID/Sudo - GTFOBins Privilege Escalation (find/vim/tar)",
    path: "linux/local/48902.txt",
    cve: "CWE-250",
    type: "local",
    platform: "linux",
  },
];

export function execSearchsploit(
  argv: string[],
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number } {
  const queryWords = argv.slice(1).filter((w) => !w.startsWith("-")).map((w) => w.toLowerCase());
  if (queryWords.length === 0) {
    return {
      stdout: "",
      stderr: "Usage: searchsploit [options] term1 [term2] ... [termN]\nExample: searchsploit vsftpd 2.3.4\n",
      code: 1,
    };
  }

  // Combine built-in exploits and any scenario-specific searchsploit entries
  const allExploits = [...COMMON_EXPLOITS];
  for (const host of scenario.hosts) {
    if (host.vulnerabilities) {
      for (const v of host.vulnerabilities) {
        if (v.searchsploitTitle && v.searchsploitPath) {
          allExploits.push({
            title: v.searchsploitTitle,
            path: v.searchsploitPath,
            cve: v.cve,
            type: "remote",
            platform: host.os,
          });
        }
      }
    }
  }

  const matches = allExploits.filter((e) =>
    queryWords.every(
      (w) =>
        e.title.toLowerCase().includes(w) ||
        e.path.toLowerCase().includes(w) ||
        (e.cve && e.cve.toLowerCase().includes(w)),
    ),
  );

  const header = `---------------------------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                                        |  Path
---------------------------------------------------------------------------------------------------------------------- ---------------------------------`;
  const footer = `---------------------------------------------------------------------------------------------------------------------- ---------------------------------
Shellcodes: No Results
Papers: No Results`;

  if (matches.length === 0) {
    return {
      stdout: `${header}\n${footer}\n`,
      stderr: "",
      code: 0,
    };
  }

  const rows = matches.map((m) => {
    const titlePadded = m.title.padEnd(117);
    return ` ${titlePadded}|  ${m.path}`;
  });

  const out = `${header}\n${rows.join("\n")}\n${footer}\n`;
  return { stdout: out, stderr: "", code: 0 };
}
