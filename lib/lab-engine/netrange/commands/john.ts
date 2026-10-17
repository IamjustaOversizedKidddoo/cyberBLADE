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
