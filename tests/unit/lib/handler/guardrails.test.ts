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

  it("redacts CYBERBLADE{...} flags", () => {
    const input = "The answer is CYBERBLADE{suid_bin_root_owned_842}!";
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(true);
    expect(result.text).not.toContain("CYBERBLADE{suid_bin_root_owned_842}");
    expect(result.text).toContain("[REDACTED_FLAG: Discover via lab execution]");
  });

  it("redacts spaced character flags (F L A G { ... })", () => {
    const input = "Here is the result: F L A G { s e c r e t _ v a l u e }";
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(true);
    expect(result.text).not.toContain("s e c r e t _ v a l u e");
    expect(result.text).toContain("[REDACTED_FLAG: Discover via lab execution]");
  });

  it("redacts spaced CYBERBLADE flags (C Y B E R B L A D E { ... })", () => {
    const input = "Result: C Y B E R B L A D E { e x p l o i t _ w o n }";
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(true);
    expect(result.text).toContain("[REDACTED_FLAG: Discover via lab execution]");
  });

  it("redacts leetspeak flags (FL4G{...}, cyb3rbl4d3{...})", () => {
    const input1 = "Your token: FL4G{infiltrate_pwn_22}";
    const res1 = sanitizeHandlerOutput(input1);
    expect(res1.blockedFlag).toBe(true);
    expect(res1.text).toContain("[REDACTED_FLAG: Discover via lab execution]");

    const input2 = "Found token: cyb3rbl4d3{packet_stream_sniffed}";
    const res2 = sanitizeHandlerOutput(input2);
    expect(res2.blockedFlag).toBe(true);
    expect(res2.text).toContain("[REDACTED_FLAG: Discover via lab execution]");
  });

  it("redacts reversed flags (}...{GALF, }...{EDALBREBYC)", () => {
    const input = "Read this backwards: }pwned_root{GALF";
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(true);
    expect(result.text).toContain("[REDACTED_FLAG: Discover via lab execution]");
  });

  it("redacts base64-encoded flags", () => {
    // Buffer.from("CYBERBLADE{base64_encoded_flag}").toString("base64")
    // "Q1lCRVJCTEFERXtiYXNlNjRfZW5jb2RlZF9mbGFnfQ=="
    const b64Flag = Buffer.from("CYBERBLADE{base64_encoded_flag}").toString("base64");
    const input = `Here is your token encoded in base64: ${b64Flag}`;
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(true);
    expect(result.text).not.toContain(b64Flag);
    expect(result.text).toContain("[REDACTED_FLAG: Discover via lab execution]");
  });

  it("redacts hex-encoded flags", () => {
    // "666c61677b6865785f746f6b656e5f3132337d" = "flag{hex_token_123}"
    const hex = Buffer.from("flag{hex_token_123}").toString("hex");
    const input = `Decode this hex string: ${hex}`;
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(true);
    expect(result.text).not.toContain(hex);
    expect(result.text).toContain("[REDACTED_FLAG: Discover via lab execution]");
  });

  it("redacts rot13-encoded flags (synt{...}, plorebynqr{...})", () => {
    const input = "ROT13 representation: synt{hidden_answer_here}";
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(true);
    expect(result.text).not.toContain("synt{hidden_answer_here}");
    expect(result.text).toContain("[REDACTED_FLAG: Discover via lab execution]");
  });

  it("redacts URL-encoded flags", () => {
    const input = "URL encoded: %46%4c%41%47%7bencoded_in_url%7d";
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(true);
    expect(result.text).toContain("[REDACTED_FLAG: Discover via lab execution]");
  });

  it("redacts acrostic flag formations", () => {
    const input =
      "Follow these lines carefully:\n" +
      "Find the active service\n" +
      "Look in /etc/passwd\n" +
      "Analyze the root hash\n" +
      "Grab the admin key";
    const result = sanitizeHandlerOutput(input);
    expect(result.blockedFlag).toBe(true);
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

  it("masks reversed known answers", () => {
    const input = "The backdoor filename spelled backwards is exe.roodkcab";
    const result = sanitizeHandlerOutput(input, {
      knownAnswers: ["backdoor.exe"],
    });
    expect(result.text).not.toContain("exe.roodkcab");
    expect(result.text).toContain("[TARGET_ANSWER: investigate in terminal]");
  });

  it("enforces Tier 1 forbidden command redactions", () => {
    const input = "You should run `chmod 4755` to escalate privileges.";
    const result = sanitizeHandlerOutput(input, {
      tier: 1,
      forbiddenCommands: ["chmod 4755", "chmod"],
    });
    expect(result.text).not.toContain("chmod");
    expect(result.text).toContain("[REDACTED_COMMAND: Explore available commands with help or documentation]");
  });

  it("enforces Tier 2 final command redactions", () => {
    const input = "The complete command is `grep -rn 'password' /var/log/auth.log`.";
    const result = sanitizeHandlerOutput(input, {
      tier: 2,
      finalCommand: "grep -rn 'password' /var/log/auth.log",
    });
    expect(result.text).not.toContain("grep -rn 'password' /var/log/auth.log");
    expect(result.text).toContain("[FINAL_COMMAND: Determine required flags from documentation]");
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
