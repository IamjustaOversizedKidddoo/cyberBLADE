/**
 * GNU chmod mode parsing: octal (`755`, `4755`) or symbolic (`u+x,g-w`, `go=r`, `+t`).
 * Returns the new mode, or null when the spec is invalid.
 */
export function parseMode(spec: string, current: number, opts: { isDir: boolean; umask: number }): number | null {
  if (/^[0-7]{1,4}$/.test(spec)) {
    const n = parseInt(spec, 8);
    // GNU keeps a directory's setuid/setgid bits under a numeric mode unless it names them.
    return opts.isDir ? n | (current & 0o6000) : n;
  }
  let mode = current;
  for (const clause of spec.split(",")) {
    const m = clause.match(/^([ugoa]*)((?:[-+=][rwxXst]*)+)$/);
    if (!m) return null;
    const who = m[1] === "" || m[1].includes("a") ? "ugo" : m[1];
    // No who-letters: like "a", but bits set in the umask are left alone.
    const allowed = m[1] === "" ? ~opts.umask & 0o777 : 0o777;
    for (const [, op, perms] of m[2].matchAll(/([-+=])([rwxXst]*)/g)) {
      let triple = 0;
      for (const p of perms) {
        if (p === "r") triple |= 4;
        else if (p === "w") triple |= 2;
        else if (p === "x") triple |= 1;
        else if (p === "X" && (opts.isDir || (mode & 0o111) !== 0)) triple |= 1;
      }
      let bits = 0;
      let reach = 0;
      if (who.includes("u")) [bits, reach] = [bits | (triple << 6), reach | 0o4700];
      if (who.includes("g")) [bits, reach] = [bits | (triple << 3), reach | 0o2070];
      if (who.includes("o")) [bits, reach] = [bits | triple, reach | 0o1007];
      bits &= allowed | 0o7000;
      if (perms.includes("s")) bits |= (who.includes("u") ? 0o4000 : 0) | (who.includes("g") ? 0o2000 : 0);
      if (perms.includes("t") && who.includes("o")) bits |= 0o1000;
      if (op === "+") mode |= bits;
      else if (op === "-") mode &= ~bits;
      else mode = (mode & ~(reach & (allowed | 0o7000))) | bits;
    }
  }
  return mode;
}
