import { describe, expect, it } from "vitest";
import { sanitizeHandlerOutput } from "@/lib/handler/guardrails";

describe("Handler Guardrails & Output Sanitization", () => {
  it("redacts raw flags matching FLAG{...}", () => {
    const input = "You can find the flag here: FLAG{sec_token_99182} inside the registry.";
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(true);
    expect(result.text).not.toContain("FLAG{sec_token_99182}");
    expect(result.text).toContain("[REDACTED_FLAG: Discover via lab execution]");
  });

  it("redacts lowercase flag formats", () => {
    const input = "The captured token is flag{hunt_pers_runkey_81} verified.";
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(true);
    expect(result.text).not.toContain("flag{hunt_pers_runkey_81}");
    expect(result.text).toContain("[REDACTED_FLAG: Discover via lab execution]");
  });

  it("masks exact known answer strings", () => {
    const input = "The suspicious service executable is located at C:\\Windows\\Temp\\backdoor.exe on the disk.";
    const result = sanitizeHandlerOutput(input, {
      knownAnswers: ["C:\\Windows\\Temp\\backdoor.exe"],
    });
    expect(result.text).not.toContain("C:\\Windows\\Temp\\backdoor.exe");
    expect(result.text).toContain("[TARGET_ANSWER: investigate in terminal]");
  });

  it("leaves normal technical prose untouched", () => {
    const input = "Run `Get-ItemProperty` to inspect the registry keys under HKLM:\\SOFTWARE.";
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(false);
    expect(result.text).toBe(input);
  });

  it("blocks transmission completely when isChallenge is true", () => {
    const input = "Here is how to solve the challenge...";
    const result = sanitizeHandlerOutput(input, { isChallenge: true });
    expect(result.text).toContain("[COMM LINK SEVERED]");
    expect(result.text).toContain("Handler assistance is offline during active rank challenges");
  });
});
