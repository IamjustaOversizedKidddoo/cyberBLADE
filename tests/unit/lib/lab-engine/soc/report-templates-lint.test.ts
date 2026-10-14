import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  loadReportTemplates,
  getReportTemplate,
  loadAttackTechniques,
  loadResponseActions,
  createEmptyReportData,
  createDraftFromCaseNotes,
} from "@/lib/lab-engine/soc/reports/templates";
import { lintReportDraft, type SessionEvidenceContext } from "@/lib/lab-engine/soc/reports/pre-submit-lint";
import type { SocReportData } from "@/lib/lab-engine/soc/reports/types";

describe("SOC Report Templates & Pre-Submit Lint", () => {
  describe("Templates & Catalogs", () => {
    it("loads report templates from YAML content", async () => {
      const templates = await loadReportTemplates();
      expect(templates.size).toBeGreaterThanOrEqual(1);
      expect(templates.has("incident-report-l1")).toBe(true);
    });

    it("gets report template by ID with safe fallback", async () => {
      const tpl = await getReportTemplate("incident-report-l1");
      expect(tpl.id).toBe("incident-report-l1");
      expect(tpl.sections.length).toBeGreaterThan(0);

      const fallback = await getReportTemplate("non-existent-template-id");
      expect(fallback).toBeDefined();
      expect(fallback.id).toBe("incident-report-l1");
    });

    it("loads curated attack techniques and response actions", async () => {
      const techniques = await loadAttackTechniques();
      expect(techniques.length).toBeGreaterThan(0);
      expect(techniques[0]).toHaveProperty("id");
      expect(techniques[0]).toHaveProperty("name");

      const actions = await loadResponseActions();
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0]).toHaveProperty("id");
      expect(actions[0]).toHaveProperty("category");
    });

    it("initializes a valid initial draft with createEmptyReportData", () => {
      const draft = createEmptyReportData("analyst-01", "CASE-2026-001", "Incident Report");

      expect(draft.header.caseId).toBe("CASE-2026-001");
      expect(draft.header.analystHandle).toBe("analyst-01");
      expect(draft.header.title).toContain("Incident Report");
      expect(draft.timeline).toEqual([]);
      expect(draft.iocs).toEqual([]);
    });

    it("pre-fills draft from learner case notes and decisions without leaking truth", () => {
      const draft = createDraftFromCaseNotes(
        {
          id: "case-01",
          attemptId: "att-01",
          title: "Investigation Case 1",
          status: "open",
          severity: "HIGH",
          alertIds: ["alt-01"],
          notes: "Analyst observed credential dumping",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        [
          {
            id: "dec-01",
            attemptId: "att-01",
            alertId: "alt-01",
            disposition: "true_positive",
            severity: "HIGH",
            escalate: true,
            targetTier: "tier2",
            evidenceRefs: [],
            rationale: "Mimikatz detected",
            createdAt: new Date().toISOString(),
          },
        ],
        "analyst-01",
      );

      expect(draft.header.title).toBe("Investigation Case 1");
      expect(draft.evidenceAppendix).toHaveLength(1);
      expect(draft.evidenceAppendix?.[0].targetId).toBe("alt-01");
    });
  });

  describe("Pre-Submit Linter (Zero Oracle Rule)", () => {
    it("reports errors on empty or incomplete draft", async () => {
      const tpl = await getReportTemplate("incident-report-l1");
      const emptyDraft: SocReportData = {
        header: {
          title: "",
          caseId: "CASE-01",
          analystHandle: "analyst",
          createdAt: new Date().toISOString(),
          classification: "TLP:AMBER",
        },
        executiveSummary: "",
        verdict: {
          disposition: "true_positive",
          severity: "HIGH",
          confidence: "high",
          justification: "",
        },
        scope: { affectedAssets: [], affectedUsers: [] },
        timeline: [],
        iocs: [],
        attackNarrative: "",
        techniques: [],
        actions: [],
        escalation: { requiresEscalation: false, urgency: "routine", handoffSummary: "" },
        evidenceAppendix: [],
      };

      const result = lintReportDraft(emptyDraft, tpl);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      const sectionErrors = result.errors.map((e) => e.sectionId);
      expect(sectionErrors).toContain("header");
      expect(sectionErrors).toContain("executive_summary");
      expect(sectionErrors).toContain("verdict_and_severity");
      expect(sectionErrors).toContain("scope_and_impact");
    });

    it("validates timeline chronological ordering and warns on unordered entries", async () => {
      const tpl = await getReportTemplate("incident-report-l1");
      const draft = createEmptyReportData("analyst-01");

      draft.header.title = "Valid Title For Investigation Report";
      draft.executiveSummary = "This is a detailed executive summary meeting the minimum length criteria for testing.";
      draft.verdict.justification = "Observed confirmed anomalous activity spanning multiple endpoints.";
      draft.scope.affectedAssets = ["WS-001"];
      draft.attackNarrative = "Detailed attack narrative exceeding fifty characters in order to validate properly.";
      draft.iocs = [{ id: "ioc-01", type: "ip", value: "198[.]51[.]100[.]1", role: "c2", evidenceRefs: [] }];
      draft.actions = [{ actionId: "isolate-host", actionName: "Isolate Host", category: "containment", priority: 1, rationale: "Prevent lateral movement spread" }];

      // Timeline in reverse chronological order
      draft.timeline = [
        {
          id: "tl-01",
          timestampUtc: "2026-10-12T12:00:00Z",
          rawTimestamp: "2026-10-12T12:00:00Z",
          timezone: "UTC",
          description: "Lateral movement observed",
          dataOrigin: "EDR",
        },
        {
          id: "tl-02",
          timestampUtc: "2026-10-12T10:00:00Z",
          rawTimestamp: "2026-10-12T10:00:00Z",
          timezone: "UTC",
          description: "Initial phishing email received",
          dataOrigin: "Email Gateway",
        },
      ];

      const result = lintReportDraft(draft, tpl);
      const timelineWarnings = result.warnings.filter((w) => w.sectionId === "timeline");
      expect(timelineWarnings.some((w) => w.message.includes("chronological order"))).toBe(true);
    });

    it("validates session evidence reference existence against visible history", async () => {
      const tpl = await getReportTemplate("incident-report-l1");
      const draft = createEmptyReportData("analyst-01");

      draft.header.title = "Valid Investigation Report Title";
      draft.executiveSummary = "This is a detailed executive summary meeting the minimum length criteria for testing.";
      draft.verdict.justification = "Observed confirmed anomalous activity spanning multiple endpoints.";
      draft.scope.affectedAssets = ["WS-001"];
      draft.attackNarrative = "Detailed attack narrative exceeding fifty characters in order to validate properly.";
      draft.timeline = [
        {
          id: "tl-01",
          timestampUtc: "2026-10-12T10:00:00Z",
          rawTimestamp: "2026-10-12T10:00:00Z",
          timezone: "UTC",
          description: "Initial phishing email received",
          dataOrigin: "Email Gateway",
          evidenceRef: "alert:alt-01",
        },
        {
          id: "tl-02",
          timestampUtc: "2026-10-12T11:00:00Z",
          rawTimestamp: "2026-10-12T11:00:00Z",
          timezone: "UTC",
          description: "Suspicious execution detected",
          dataOrigin: "EDR",
          evidenceRef: "query:qry-99", // Unobserved query ID
        },
      ];
      draft.iocs = [{ id: "ioc-01", type: "ip", value: "198[.]51[.]100[.]1", role: "c2", evidenceRefs: ["lookup:lkp-01"] }];
      draft.actions = [{ actionId: "isolate-host", actionName: "Isolate Host", category: "containment", priority: 1, rationale: "Prevent lateral movement spread" }];

      const sessionContext: SessionEvidenceContext = {
        visibleAlertIds: new Set(["alt-01"]),
        visibleEventIds: new Set(),
        visibleQueryIds: new Set(["qry-01"]), // qry-99 is not visible
        visibleLookupIds: new Set(["lkp-01"]),
      };

      const result = lintReportDraft(draft, tpl, sessionContext);
      const evidenceWarnings = result.warnings.filter((w) => w.sectionId === "evidence_appendix");
      expect(evidenceWarnings.length).toBeGreaterThan(0);
      expect(evidenceWarnings[0].message).toContain("query:qry-99");
    });
  });
});
