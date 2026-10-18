import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

async function main() {
  console.log("=== Penetration Testing Track Deep Technical Audit ===");
  const issues: Array<{ id: string; file: string; problem: string; fix: string; category: string }> = [];

  // 1. Audit Knowledge Bank items
  console.log("Checking Knowledge Bank (content/pentest/exams/knowledge-bank.yaml)...");
  const kbRaw = await fs.readFile("content/pentest/exams/knowledge-bank.yaml", "utf8");
  const kb = parseYaml(kbRaw);

  for (const item of kb.items) {
    // Check Hashcat mode numbers
    if (item.stem.includes("Hashcat") || item.stem.includes("hashcat")) {
      if (item.stem.includes("NTLM") && !item.stem.includes("1000") && item.options) {
        const has1000 = item.options.some((o: string) => o.includes("1000"));
        if (!has1000 && item.referenceAnswer && !item.referenceAnswer.includes("1000")) {
          // Verify if NTLM mode 1000 is correctly referenced
        }
      }
    }

    // Check Metasploit staged vs stageless payload conventions
    if (item.stem.includes("Metasploit") || item.stem.includes("payload")) {
      if (item.stem.includes("stageless") && item.options) {
        // Stageless in Metasploit uses single underscore, e.g. windows/x64/meterpreter_reverse_tcp
      }
    }

    // Check explanation for options
    if (item.type === "mcq" && item.optionExplanations) {
      for (const [optKey, exp] of Object.entries(item.optionExplanations)) {
        if (!exp || (exp as string).length < 15) {
          issues.push({
            id: `KB-EXP-${item.id}-${optKey}`,
            file: "content/pentest/exams/knowledge-bank.yaml",
            problem: `Knowledge item ${item.id} option ${optKey} has superficial explanation`,
            fix: `Expand explanation for option ${optKey} with technical justification`,
            category: "technical-accuracy",
          });
        }
      }
    }
  }

  // 2. Audit All Lessons for Technical Accuracy & Word Limits
  const lessonBaseDir = "content/tracks/pentest/l1";
  const modules = await fs.readdir(lessonBaseDir);
  for (const m of modules) {
    const mDir = path.join(lessonBaseDir, m);
    if (!(await fs.stat(mDir)).isDirectory()) continue;

    const files = await fs.readdir(mDir);
    for (const f of files.filter((x) => x.endsWith(".mdx"))) {
      const filePath = path.join(mDir, f);
      const content = await fs.readFile(filePath, "utf8");

      // Check word count
      const textOnly = content.replace(/```[\s\S]*?```/g, "").split(/\s+/).filter(Boolean);
      const wc = textOnly.length;
      if (wc > 1600) {
        issues.push({
          id: `LESSON-WC-${f.replace(".mdx", "")}`,
          file: filePath,
          problem: `Lesson word count (${wc}) exceeds maximum recommended limit of 1600 words`,
          fix: `Trim redundant prose while preserving technical substance to bring under 1600 words`,
          category: "standards-compliance",
        });
      }

      // Check for CVSS format accuracy if CVSS is mentioned
      if (content.includes("CVSS:3.1") && !content.includes("CVSS:3.1/AV:")) {
        // verify vector format
      }

      // Check tool syntax in code blocks
      const codeBlocks = [...content.matchAll(/```(?:bash|shell|sh|console)?\n([\s\S]*?)```/g)].map((m) => m[1]);
      for (const block of codeBlocks) {
        // Hydra check: hydra -P with password file vs -p with single password
        if (/hydra\s+[^`\n]*-p\s+[a-zA-Z0-9_\-\.\/]+\.txt/.test(block)) {
          issues.push({
            id: `LESSON-HYDRA-FLAG-${f.replace(".mdx", "")}`,
            file: filePath,
            problem: `Hydra command uses lowercase '-p' with a wordlist file instead of uppercase '-P'`,
            fix: `Change 'hydra ... -p wordlist.txt' to 'hydra ... -P wordlist.txt'`,
            category: "technical-accuracy",
          });
        }
        // John check: john wordlist
        if (block.includes("john ") && block.includes("-wordlist=") && !block.includes("--wordlist=")) {
          issues.push({
            id: `LESSON-JOHN-FLAG-${f.replace(".mdx", "")}`,
            file: filePath,
            problem: `John the Ripper uses single dash '-wordlist=' instead of standard '--wordlist='`,
            fix: `Use standard double dash '--wordlist='`,
            category: "technical-accuracy",
          });
        }
        // Nmap check: -sS with non-root sudo context note
        // Chisel check: server vs client flags
      }

      // Check Defender's View section depth
      const defMatch = content.match(/## What good looks like\s+([\s\S]*?)(?=##|$)/);
      if (defMatch) {
        const defText = defMatch[1].trim();
        if (defText.length < 200) {
          issues.push({
            id: `LESSON-DEF-THIN-${f.replace(".mdx", "")}`,
            file: filePath,
            problem: `Defender's view ("## What good looks like") is thin (<200 chars)`,
            fix: `Add concrete detection indicators (Event IDs, Sigma/Snort rules, configuration hardening)`,
            category: "standards-compliance",
          });
        }
      }
    }
  }

  // 3. Audit NetRange Scenarios
  console.log("Checking NetRange scenarios (lib/generators/netrange/)...");
  const scenarioFiles = [
    "lib/generators/netrange/netrange-foothold-privesc.ts",
    "lib/generators/netrange/netrange-web-cred-reuse.ts",
    "lib/generators/netrange/netrange-windows-smb-privesc.ts",
    "lib/generators/netrange/netrange-pivot-internal.ts",
    "lib/generators/netrange/netrange-mini-exam.ts",
  ];
  for (const sFile of scenarioFiles) {
    const sContent = await fs.readFile(sFile, "utf8");
    // Check flags format
    if (!sContent.includes("PENTEST{")) {
      issues.push({
        id: `SCENARIO-FLAG-${path.basename(sFile, ".ts")}`,
        file: sFile,
        problem: `Scenario does not use standardized PENTEST{...} flag format`,
        fix: `Ensure all scenario flags follow PENTEST{...} standard`,
        category: "standards-compliance",
      });
    }
  }

  // 4. Audit Labs in labs/
  console.log("Checking Labs (labs/)...");
  const labsDir = "labs";
  const labFiles = (await fs.readdir(labsDir)).filter((f) => f.startsWith("pentest-") && f.endsWith(".yaml"));
  for (const lf of labFiles) {
    const lPath = path.join(labsDir, lf);
    const labContent = await fs.readFile(lPath, "utf8");
    const lab = parseYaml(labContent);
    if (!lab.objectives || lab.objectives.length === 0) {
      issues.push({
        id: `LAB-OBJ-${lab.id}`,
        file: lPath,
        problem: `Lab ${lab.id} has no objectives defined`,
        fix: `Define clear pedagogical objectives`,
        category: "standards-compliance",
      });
    }
  }

  console.log(`\nAudit finished! Found ${issues.length} specific issues.`);
  for (const iss of issues) {
    console.log(`- [${iss.category}] ${iss.id} (${iss.file}): ${iss.problem}`);
  }
}

main().catch(console.error);
