import type { NetRangeScenario, NetRangeState } from "../types";

export function execJohn(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number; nextState?: NetRangeState } {
  let wordlistName = "rockyou.txt";
  let targetFile = "";
  let showMode = false;

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--wordlist=")) {
      wordlistName = a.split("=")[1];
    } else if (a === "--show") {
      showMode = true;
    } else if (!a.startsWith("-")) {
      targetFile = a;
    }
  }

  const nextState = { ...state, crackedHashes: { ...state.crackedHashes } };

  if (showMode) {
    const rows = Object.entries(nextState.crackedHashes).map(
      ([hash, plain]) => `${hash.slice(0, 16)}...:${plain}`,
    );
    if (rows.length === 0) {
      return { stdout: "0 password hashes cracked, 0 left\n", stderr: "", code: 0 };
    }
    return {
      stdout: `${rows.join("\n")}\n\n${rows.length} password hash${rows.length === 1 ? "" : "es"} cracked, 0 left\n`,
      stderr: "",
      code: 0,
    };
  }

  if (!targetFile) {
    return { stdout: "", stderr: "Usage: john [OPTIONS] [PASSWORD-FILES]\nExample: john --wordlist=rockyou.txt hashes.txt\n", code: 1 };
  }

  // Find all hashes in scenario users
  const candidates: Array<{ hash: string; plain: string; user: string }> = [];
  for (const host of scenario.hosts) {
    for (const u of host.users) {
      if (u.hash && u.password) {
        candidates.push({ hash: u.hash, plain: u.password, user: u.username });
      }
    }
  }

  const wordlist = scenario.wordlists?.[wordlistName] ?? [
    "password",
    "123456",
    "admin123",
    "summer2024",
    "P@ssw0rd2026!",
    "hunter2",
    "iloveyou",
    "apex2026",
    "svc_deploy",
  ];

  const cracked: Array<{ user: string; plain: string }> = [];
  for (const cand of candidates) {
    if (wordlist.includes(cand.plain) || wordlist.some((w) => w.toLowerCase() === cand.plain.toLowerCase())) {
      nextState.crackedHashes[cand.hash] = cand.plain;
      cracked.push({ user: cand.user, plain: cand.plain });
    }
  }

  const out = [
    `Using default input encoding: UTF-8`,
    `Loaded ${candidates.length} password hash (md5crypt, crypt(3) $1$ [MD5 256/256 AVX2 8x3])`,
    `Will run 8 OpenMP threads`,
    `Press 'q' or Ctrl-C to abort, almost any other key for status`,
  ];

  for (const c of cracked) {
    out.push(`${c.plain.padEnd(16)} (${c.user})`);
  }

  out.push(`${cracked.length}g 0:00:00:00 DONE (2026-10-17 12:08) 100.0g/s 4520p/s 4520c/s 4520C/s`);
  out.push(`Use the "--show" option to display all of the cracked passwords reliably`);

  return { stdout: out.join("\n") + "\n", stderr: "", code: 0, nextState };
}

export function execHashcat(
  argv: string[],
  state: NetRangeState,
  scenario: NetRangeScenario,
): { stdout: string; stderr: string; code: number; nextState?: NetRangeState } {
  let mode = "0";
  let targetFile = "";
  let wordlistName = "rockyou.txt";
  let showMode = false;

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-m" && i + 1 < argv.length) {
      mode = argv[++i];
    } else if (a.startsWith("-m")) {
      mode = a.slice(2);
    } else if (a === "--show") {
      showMode = true;
    } else if (a === "-a" && i + 1 < argv.length) {
      i++; // attack mode e.g. 0
    } else if (!a.startsWith("-")) {
      if (!targetFile) {
        targetFile = a;
      } else {
        wordlistName = a.split("/").pop() ?? a;
      }
    }
  }

  const nextState = { ...state, crackedHashes: { ...state.crackedHashes } };

  if (showMode) {
    const rows = Object.entries(nextState.crackedHashes).map(
      ([hash, plain]) => `${hash}:${plain}`,
    );
    return {
      stdout: (rows.length > 0 ? rows.join("\n") + "\n" : ""),
      stderr: "",
      code: 0,
    };
  }

  if (!targetFile) {
    return {
      stdout: "",
      stderr: "Usage: hashcat [options]... hashfile|hash|mask|hccapx [dictionary|mask|directory]...\nExample: hashcat -m 0 -a 0 hashes.txt rockyou.txt\n",
      code: 1,
    };
  }

  // Find all candidate hashes
  const candidates: Array<{ hash: string; plain: string; user: string }> = [];
  for (const host of scenario.hosts) {
    for (const u of host.users) {
      if (u.hash && u.password) {
        candidates.push({ hash: u.hash, plain: u.password, user: u.username });
      }
    }
  }

  if (candidates.length === 0) {
    candidates.push({
      hash: "5f4dcc3b5aa765d61d8327deb882cf99",
      plain: "password",
      user: "admin",
    });
  }

  const wordlist = scenario.wordlists?.[wordlistName] ?? [
    "password",
    "123456",
    "admin123",
    "summer2024",
    "P@ssw0rd2026!",
    "hunter2",
    "iloveyou",
    "apex2026",
    "svc_deploy",
  ];

  const cracked: Array<{ hash: string; plain: string; user: string }> = [];
  for (const cand of candidates) {
    if (wordlist.includes(cand.plain) || wordlist.some((w) => w.toLowerCase() === cand.plain.toLowerCase())) {
      nextState.crackedHashes[cand.hash] = cand.plain;
      cracked.push(cand);
    }
  }

  const modeNames: Record<string, string> = {
    "0": "MD5",
    "1000": "NTLM",
    "1800": "sha512crypt $6$, SHA512 (Unix)",
    "3200": "bcrypt $2*$, Blowfish (Unix)",
  };

  const modeDesc = modeNames[mode] ?? `Hash Type ${mode}`;

  const crackedLines = cracked.map((c) => `${c.hash}:${c.plain}`);

  const out = `
hashcat (v6.2.6) starting

OpenCL API (OpenCL 3.0 PoCL 3.1+debian) - Platform #1 [The pocl project]
========================================================================
* Device #1: pthread-Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz, 2901 MB available, 8MCU

Minimum password length supported by kernel: 0
Maximum password length supported by kernel: 256

Hashes: ${candidates.length} digests; ${candidates.length} unique digests
Bitmaps: 16 bits, 65536 entries, 0x0000ffff mask, 262144 bytes, 5/13 rotates
Rules: 1

Applicable optimizers applied:
* Zero-Byte
* Early-Skip
* Not-Salted

ATTACK: Straight Dictionary
Dictionary: ${wordlistName} (${wordlist.length} words)

${crackedLines.length > 0 ? crackedLines.join("\n") + "\n" : ""}
Session..........: hashcat
Status...........: ${cracked.length > 0 ? "Cracked" : "Exhausted"}
Hash.Mode........: ${mode} (${modeDesc})
Hash.Target......: ${targetFile}
Time.Started.....: Sat Oct 17 12:15:00 2026
Time.Estimated...: Sat Oct 17 12:15:01 2026 (1 sec)
Speed.#1.........:  1485.2 kH/s (0.42ms) @ Accel:1024 Loops:1 Thr:1 Vec:8
Recovered........: ${cracked.length}/${candidates.length} (${candidates.length > 0 ? Math.round((cracked.length / candidates.length) * 100) : 0}.00%) Digests
Progress.........: ${wordlist.length}/${wordlist.length} (100.00%)
Rejected.........: 0/${wordlist.length} (0.00%)

Started: Sat Oct 17 12:15:00 2026
Stopped: Sat Oct 17 12:15:01 2026
`;

  return { stdout: out.trim() + "\n", stderr: "", code: 0, nextState };
}
