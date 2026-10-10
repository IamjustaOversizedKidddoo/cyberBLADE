export type Rule = {
  who: string;
  runAs: string;
  nopasswd: boolean;
  commands: string[];
};

export type SudoersParseResult = {
  defaults: string[];
  rules: Rule[];
};

/** Parse Defaults entries from a line, handling commas outside quotes. */
function parseDefaultsLine(line: string): string[] {
  const rest = line.replace(/^Defaults\s+/, "").trim();
  const items: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < rest.length; i++) {
    const char = rest[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "," && !inQuotes) {
      if (current.trim()) items.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

/** Parse an /etc/sudoers file text. */
export function parseSudoers(text: string): SudoersParseResult {
  const defaults: string[] = [];
  const rules: Rule[] = [];

  const lines = text.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("Defaults")) {
      defaults.push(...parseDefaultsLine(line));
      continue;
    }

    // Match: who ALL=(runAs) [NOPASSWD:] commands
    const match = line.match(/^([%\w.-]+)\s+ALL\s*=\s*\(([^)]+)\)\s*(NOPASSWD:\s*)?(.*)$/);
    if (match) {
      const who = match[1];
      const runAs = match[2].trim();
      const nopasswd = Boolean(match[3]);
      const rawCommands = match[4].trim();
      const commands = rawCommands ? rawCommands.split(",").map((c) => c.trim()) : [];

      rules.push({ who, runAs, nopasswd, commands });
    }
  }

  return { defaults, rules };
}

/** Return rules matching the given user or one of their group memberships. */
export function rulesFor(rules: Rule[], user: string, groups: string[]): Rule[] {
  return rules.filter((r) => {
    if (r.who === user) return true;
    if (r.who.startsWith("%")) {
      const grp = r.who.slice(1);
      return groups.includes(grp);
    }
    return false;
  });
}
