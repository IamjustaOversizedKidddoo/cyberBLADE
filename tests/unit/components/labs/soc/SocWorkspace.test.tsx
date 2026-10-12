// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SocWorkspace } from "@/components/labs/soc/SocWorkspace";
import type { SocSessionClient } from "@/lib/lab-engine/soc/types";

// Mock server actions
const mockRecordDecision = vi.fn();
const mockManageCase = vi.fn();
const mockSubmitAttempt = vi.fn();
const mockAbandonAttempt = vi.fn();

vi.mock("@/app/(app)/labs/soc/actions", () => ({
  recordSocDecisionAction: (...args: unknown[]) => mockRecordDecision(...args),
  manageSocCaseAction: (...args: unknown[]) => mockManageCase(...args),
  submitSocAttemptAction: (...args: unknown[]) => mockSubmitAttempt(...args),
  abandonSocAttemptAction: (...args: unknown[]) => mockAbandonAttempt(...args),
}));

const mockSession: SocSessionClient = {
  attempt: {
    id: "test-attempt-uuid-1",
    scenarioId: "soc-l1-noisy-shift",
    status: "in_progress",
    startedAt: "2026-10-12T10:00:00Z",
    submittedAt: null,
  },
  scenario: {
    id: "soc-l1-noisy-shift",
    version: 1,
    title: "L1 Demo: A Noisy Morning Shift",
    level: "L1",
    estimatedMinutes: 45,
    skillsTested: ["soc_alert_triage", "soc_incident_correlation"],
    difficulty: "intermediate",
    briefing: "Frontline shift defending Apex Global Logistics.",
    environment: {
      assets: [
        {
          id: "ast-01",
          hostname: "ws-fin-04.corp.internal",
          ip: "10.0.1.104",
          role: "Workstation",
          os: "Windows 11 Pro",
          criticality: "MEDIUM",
          owner: "Finance",
          zone: "Workstations",
          tags: ["finance"],
        },
      ],
      users: [
        {
          id: "usr-01",
          username: "emiller",
          email: "emiller@corp.internal",
          displayName: "Emily Miller",
          department: "Finance",
          role: "Accountant",
          riskScore: 25,
        },
      ],
      networkZones: [{ id: "z1", name: "Workstations", cidr: "10.0.1.0/24", description: "User subnet" }],
    },
    alerts: [
      {
        id: "alt-001",
        timestamp: "2026-10-12T07:15:22Z",
        source: "Email Gateway",
        ruleName: "SUSPICIOUS_ATTACHMENT_MACRO_DETECTED",
        severity: "HIGH",
        summary: "Inbound invoice with malicious macro targeting emiller",
        relatedAsset: "ws-fin-04.corp.internal",
        relatedUser: "emiller",
        linkedRawEvents: [],
        rawFields: { subject: "Overdue Invoice", hash: "synthetic-md5-001" },
      },
      {
        id: "alt-002",
        timestamp: "2026-10-12T07:18:00Z",
        source: "EDR",
        ruleName: "POWERSHELL_OBFUSCATED_COMMANDLINE",
        severity: "CRITICAL",
        summary: "Encoded powershell command line executed on ws-fin-04",
        relatedAsset: "ws-fin-04.corp.internal",
        relatedUser: "emiller",
        linkedRawEvents: [],
        rawFields: { command: "powershell -enc JABzAD0..." },
      },
      {
        id: "alt-003",
        timestamp: "2026-10-12T07:25:00Z",
        source: "Network IDS",
        ruleName: "ROUTINE_NTP_SYNC_SWEEP",
        severity: "INFO",
        summary: "Standard clock synchronization from time.corp.internal",
        linkedRawEvents: [],
        rawFields: { dest_port: "123" },
      },
    ],
  },
  decisions: {},
  cases: [],
  results: null,
};

describe("SocWorkspace UI Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders command bar, queue counters, and alert list", () => {
    render(<SocWorkspace session={mockSession} />);

    expect(screen.getByText("SOC//WORKSPACE")).toBeInTheDocument();
    expect(screen.getByText("L1 Demo: A Noisy Morning Shift")).toBeInTheDocument();
    expect(screen.getByText("3 Total")).toBeInTheDocument();
    expect(screen.getByText("3 Untriaged")).toBeInTheDocument();

    // Alert rule names visible
    expect(screen.getAllByText("SUSPICIOUS_ATTACHMENT_MACRO_DETECTED").length).toBeGreaterThan(0);
  });

  it("displays asset and user profile in detail panel for selected alert", () => {
    render(<SocWorkspace session={mockSession} />);

    // Asset and user context loaded
    expect(screen.getAllByText("ws-fin-04.corp.internal").length).toBeGreaterThan(0);
    expect(screen.getByText(/emiller \(Emily Miller\)/)).toBeInTheDocument();
    expect(screen.getByText("CMDB Asset Profile")).toBeInTheDocument();
    expect(screen.getByText("User Identity Profile")).toBeInTheDocument();
  });

  it("allows operator to choose disposition and submit triage decision", async () => {
    mockRecordDecision.mockResolvedValueOnce({
      id: "dec-001",
      attemptId: "test-attempt-uuid-1",
      alertId: "alt-001",
      disposition: "true_positive",
      severity: "HIGH",
      escalate: true,
      targetTier: "tier2",
      rationale: "Adversary macro delivered via email payload to accounting employee.",
      evidenceRefs: ["alt-001"],
      createdAt: "2026-10-12T10:05:00Z",
    });

    render(<SocWorkspace session={mockSession} />);

    // Select True Positive (exact regex matching)
    const tpButton = screen.getByRole("button", { name: /^True Positive/i });
    await userEvent.click(tpButton);

    // Enter rationale (> 10 chars)
    const textarea = screen.getByPlaceholderText(/State: WHAT occurred/i);
    await userEvent.type(
      textarea,
      "Adversary macro delivered via email payload to accounting employee.",
    );

    // Save decision
    const saveButton = screen.getByRole("button", { name: /Save Decision/i });
    await userEvent.click(saveButton);

    expect(mockRecordDecision).toHaveBeenCalledWith(
      "test-attempt-uuid-1",
      "alt-001",
      expect.objectContaining({
        disposition: "true_positive",
        escalate: true,
        rationale: "Adversary macro delivered via email payload to accounting employee.",
      }),
    );
  });

  it("opens keyboard shortcuts dialog when clicking '?'", async () => {
    render(<SocWorkspace session={mockSession} />);

    const helpButton = screen.getByRole("button", { name: "?" });
    await userEvent.click(helpButton);

    expect(screen.getByText("Keyboard Navigation Shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Move selection down in alert queue")).toBeInTheDocument();
  });

  it("shows confirmation modal when submitting shift with untriaged alerts", async () => {
    render(<SocWorkspace session={mockSession} />);

    const submitButton = screen.getByRole("button", { name: /Submit Shift/i });
    await userEvent.click(submitButton);

    expect(screen.getByText("Submit Shift Evaluation?")).toBeInTheDocument();
    expect(screen.getByText(/3 alerts remain untriaged/i)).toBeInTheDocument();
  });
});
