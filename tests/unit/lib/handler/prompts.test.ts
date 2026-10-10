import { describe, expect, it } from "vitest";
import { buildSystemPrompt, detectCommand } from "@/lib/handler/prompts";

describe("Handler Prompts & Command Detection", () => {
  it("detects learner commands accurately", () => {
    expect(detectCommand("what is a firewall?")).toBe("what_is");
    expect(detectCommand("What's TCP?")).toBe("what_is");
    expect(detectCommand("why?")).toBe("why");
    expect(detectCommand("Why do we need this?")).toBe("why");
    expect(detectCommand("explain again")).toBe("explain_again");
    expect(detectCommand("simplify")).toBe("simplify");
    expect(detectCommand("make it simpler please")).toBe("simplify");
    expect(detectCommand("deep dive into the headers")).toBe("deep_dive");
    expect(detectCommand("give me an example")).toBe("example");
    expect(detectCommand("draw a diagram")).toBe("diagram");
    expect(detectCommand("test me on this")).toBe("test");
    expect(detectCommand("mock interview")).toBe("interview");
    expect(detectCommand("quick revision")).toBe("revision");
    expect(detectCommand("recap everything")).toBe("recap");
    expect(detectCommand("give me a hint for objective 1")).toBe("hint");
    expect(detectCommand("how does port 443 relate to ssl?")).toBe("custom");
  });

  it("builds lesson system prompt with Professor Mode guidelines", () => {
    const prompt = buildSystemPrompt({
      kind: "lesson",
      lessonId: "17-win-arch-registry",
      lessonTitle: "Windows Architecture & Registry",
      module: "Windows Security",
      rank: 1,
      lessonExcerpt: "The Windows Registry is a hierarchical database...",
    });

    expect(prompt).toContain("The Handler");
    expect(prompt).toContain("Professor Mode");
    expect(prompt).toContain("THE 5-SECOND RULE");
    expect(prompt).toContain("17-win-arch-registry");
    expect(prompt).toContain("Windows Architecture & Registry");
    expect(prompt).toContain("The Windows Registry is a hierarchical database");
  });

  it("builds lab system prompt with objective and hint ladder context", () => {
    const prompt = buildSystemPrompt({
      kind: "lab",
      labId: "core-r1-win-registry-lab-01",
      labTitle: "Registry Persistence Hunt",
      objectives: [
        { id: "o1", prompt: "Find the rogue run key", solved: false },
        { id: "o2", prompt: "Extract binary path", solved: true },
      ],
      hints: {
        o1: ["Check HKLM Run key", "Look for non-default value"],
      },
      recentCommands: ["Get-ItemProperty HKLM:\\SOFTWARE\\..."],
    });

    expect(prompt).toContain("core-r1-win-registry-lab-01");
    expect(prompt).toContain("[o1] Find the rogue run key (UNSOLVED)");
    expect(prompt).toContain("[o2] Extract binary path (SOLVED)");
    expect(prompt).toContain("Tier 1: Check HKLM Run key");
    expect(prompt).toContain("$ Get-ItemProperty HKLM:\\SOFTWARE\\...");
  });

  it("builds challenge system prompt with silent mode lockout", () => {
    const prompt = buildSystemPrompt({
      kind: "lab",
      isChallenge: true,
      labTitle: "Operation Iron Gate",
    });

    expect(prompt).toContain("CHALLENGE MODE ENGAGED");
    expect(prompt).toContain("SILENT MODE");
    expect(prompt).toContain("Handler comms are severed during active clearance challenges");
  });
});
