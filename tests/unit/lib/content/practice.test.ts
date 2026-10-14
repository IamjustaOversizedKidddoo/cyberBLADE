import { describe, expect, it } from "vitest";
import { resolvePracticeTarget, type PracticeCard } from "@/lib/content/practice";

const title = (id: string) => (id === "core-r1-net-dns-01" ? "DNS" : null);
const card = (t: string) => resolvePracticeTarget(t, title) as PracticeCard;

describe("resolvePracticeTarget", () => {
  it("resolves families, shifts, tools, report sections and lessons to real routes", () => {
    expect(card("family:soc-f-phishing-cred-01")).toMatchObject({ kind: "family", href: "/labs/soc/soc-f-phishing-cred-01" });
    expect(card("shift:shift-quiet-day").href).toBe("/labs/soc/shift-quiet-day");
    expect(card("tool:email_headers")).toMatchObject({ kind: "tool", href: "/labs/soc/soc-f-phishing-cred-01" });
    expect(card("report:verdict_and_severity").title).toMatch(/^Report section: /);
    expect(card("drill:drill-07")).toMatchObject({ kind: "drill", href: "/practice/drills/drill-07" });
    expect(card("lesson:core-r1-net-dns-01")).toMatchObject({ title: "DNS", href: "/learn/core-r1-net-dns-01" });
  });

  it("returns an error string for unknown ids and for kinds with no page yet", () => {
    for (const t of ["family:soc-f-nope-01", "shift:nope", "tool:nope", "report:nope", "lesson:nope", "drill:drill-99", "skill:soc_alert_triage"]) {
      expect(typeof resolvePracticeTarget(t, title), t).toBe("string");
    }
  });
});
