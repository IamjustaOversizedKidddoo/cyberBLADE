import { describe, expect, it } from "vitest";
import { HeuristicProvider } from "@/lib/handler/providers/heuristic";
import { ResilientHandlerProvider } from "@/lib/handler/providers/factory";
import type { HandlerProvider } from "@/lib/handler/providers/types";

describe("Handler Providers", () => {
  const provider = new HeuristicProvider();

  it("generates 5-second answer and analogy for what_is command", async () => {
    const res = await provider.generateReply(
      "Title: Windows Registry\nCURRENT LESSON CONTEXT",
      [],
      "what is the registry?",
    );
    expect(res).toContain("1. What is the registry?");
    expect(res).toContain("2. Why does it exist?");
    expect(res).toContain("4. Simple Analogy");
    expect(res).toContain("5. Remember it like this:");
  });

  it("generates cause and effect for why command", async () => {
    const res = await provider.generateReply("Title: SUID Permissions", [], "why?");
    expect(res).toContain("Simple reason:");
    expect(res).toContain("Technical reason:");
  });

  it("generates plain English explanation for simplify command", async () => {
    const res = await provider.generateReply("Title: Network Subnetting", [], "simplify");
    expect(res).toContain("In Plain English (No Jargon)");
  });

  it("generates ASCII architecture flow for diagram command", async () => {
    const res = await provider.generateReply("Title: Packet Inspection", [], "diagram");
    expect(res).toContain("+------------------+");
    expect(res).toContain("Security Gate");
    expect(res).toContain("Telemetry Log");
  });

  it("generates 5-question check for test command", async () => {
    const res = await provider.generateReply("Title: PowerShell Cmdlets", [], "test me");
    expect(res).toContain("1. **Basic:**");
    expect(res).toContain("2. **Conceptual:**");
    expect(res).toContain("3. **Practical:**");
    expect(res).toContain("4. **Security:**");
    expect(res).toContain("5. **Scenario:**");
  });

  it("handles offline challenge mode", async () => {
    const res = await provider.generateReply("CHALLENGE MODE ENGAGED", [], "help me please");
    expect(res).toContain("[COMM LINK SEVERED]");
  });

  it("ResilientHandlerProvider gracefully falls back to Heuristic when custom provider fails", async () => {
    const failingProvider: HandlerProvider = {
      name: "groq",
      generateReply: async () => {
        throw new Error("Network offline");
      },
    };

    const resilient = new ResilientHandlerProvider([failingProvider, new HeuristicProvider()]);
    const res = await resilient.generateReply("Title: File Forensics", [], "what is file hashing?");
    expect(res).toContain("What is file hashing?");
  });
});
