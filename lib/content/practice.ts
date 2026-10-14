/**
 * Resolves typed "Practice this" targets (frontmatter `practice`) to real places in the app.
 * Used by the lesson reader and by the content linter, so a broken target fails check:content.
 */
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { BLADEQL_DRILLS } from "@/lib/lab-engine/soc/query/drills";

export interface PracticeCard {
  target: string;
  kind: string;
  title: string;
  href: string;
  instruction: string;
}

const TOOL_LABELS: Record<string, { name: string; family: string }> = {
  reputation: { name: "Reputation lookup", family: "soc-f-phishing-cred-01" },
  whois: { name: "WHOIS-style registration lookup", family: "soc-f-phishing-cred-01" },
  pdns: { name: "Passive DNS history", family: "soc-f-outbound-exfil-01" },
  email_headers: { name: "Email header analyzer", family: "soc-f-phishing-cred-01" },
  url_analysis: { name: "URL analysis report", family: "soc-f-phishing-cred-01" },
  sandbox: { name: "Sandbox-style file report", family: "soc-f-attachment-script-01" },
  pcap_flows: { name: "Flow and capture view", family: "soc-f-outbound-exfil-01" },
  endpoint_timeline: { name: "Endpoint timeline", family: "soc-f-attachment-script-01" },
  cmdb: { name: "Asset directory", family: "soc-f-mixed-signal-01" },
  tickets: { name: "Service tickets", family: "soc-f-mixed-signal-01" },
};

const REPORT_SCENARIO = "soc-l1-noisy-shift";

function yamlTitle(file: string, pick: (doc: Record<string, unknown>) => unknown): string | null {
  if (!fs.existsSync(file)) return null;
  const doc = parseYaml(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  const t = pick(doc);
  return typeof t === "string" ? t : null;
}

function reportSectionTitle(sectionId: string): string | null {
  const file = path.resolve("content/soc/report-templates/incident-report-l1.yaml");
  const doc = parseYaml(fs.readFileSync(file, "utf8")) as { sections: Array<{ id: string; title: string }> };
  return doc.sections.find((s) => s.id === sectionId)?.title ?? null;
}

/** Returns the card, or an error string for the linter. `lessonTitle` resolves lesson targets. */
export function resolvePracticeTarget(target: string, lessonTitle: (id: string) => string | null): PracticeCard | string {
  const [kind, id] = target.split(":");
  switch (kind) {
    case "family": {
      const title = yamlTitle(path.resolve(`content/soc/families/${id}.yaml`), (d) => (d.metadata as { title?: string } | undefined)?.title);
      return title
        ? { target, kind, title, href: `/labs/soc/${id}`, instruction: "Work this scenario in the SOC workspace." }
        : `unknown scenario family ${id}`;
    }
    case "shift": {
      const title = yamlTitle(path.resolve(`content/soc/shifts/${id}.yaml`), (d) => d.title);
      return title ? { target, kind, title, href: `/labs/soc/${id}`, instruction: "Run a full simulated shift." } : `unknown shift ${id}`;
    }
    case "tool": {
      const t = TOOL_LABELS[id];
      return t
        ? { target, kind, title: t.name, href: `/labs/soc/${t.family}`, instruction: `Open the Investigation Workbench (Tools) and use the ${t.name.toLowerCase()}.` }
        : `unknown tool ${id}`;
    }
    case "report": {
      const title = reportSectionTitle(id);
      return title
        ? { target, kind, title: `Report section: ${title}`, href: `/labs/soc/${REPORT_SCENARIO}`, instruction: `Open the Incident Report tab and write the "${title}" section.` }
        : `unknown report section ${id}`;
    }
    case "lesson": {
      const title = lessonTitle(id);
      return title ? { target, kind, title, href: `/learn/${id}`, instruction: "Revisit this lesson." } : `unknown lesson ${id}`;
    }
    case "drill": {
      const d = BLADEQL_DRILLS.find((x) => x.id === id);
      return d
        ? { target, kind, title: `Query drill: ${d.title.replace(/^\d+\.\s*/, "")}`, href: `/practice/drills/${id}`, instruction: "Write the query and check it on the practice dataset." }
        : `unknown drill ${id}`;
    }
    default:
      // skill targets have no page of their own yet (see docs/ops/pilot-lesson-review.md).
      return `practice kind "${kind}" has no page yet`;
  }
}
