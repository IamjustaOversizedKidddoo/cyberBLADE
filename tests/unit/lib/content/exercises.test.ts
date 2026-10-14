import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { isAcceptedAnswer, normalizeAnswer, parseExercises, refang, toPublicExercises } from "@/lib/content/exercises";

const headers = parseExercises(fs.readFileSync("content/tracks/soc/l1/m04-email/13-header-analysis.exercises.yaml", "utf8"), "headers");
const triage = parseExercises(fs.readFileSync("content/tracks/soc/l1/m02-triage/05-triage-loop.exercises.yaml", "utf8"), "triage");
const q = (set: typeof headers, id: string) => set.exercises[0].questions.find((x) => x.id === id)!;

describe("exercise answer checking", () => {
  it("refangs common defang styles", () => {
    expect(refang("192.0.2[.]58")).toBe("192.0.2.58");
    expect(refang("hxxps://docshare(.)example[.]net")).toBe("https://docshare.example.net");
    expect(refang("a[@]b[dot]example")).toBe("a@b.example");
  });

  it("accepts plain, defanged, padded and upper-case IPs", () => {
    const ip = q(headers, "delivering-ip");
    for (const a of ["192.0.2.58", "192.0.2[.]58", "  192.0.2.58 ", "192(.)0(.)2(.)58"]) expect(isAcceptedAnswer(ip, a), a).toBe(true);
  });

  it("rejects near misses", () => {
    const ip = q(headers, "delivering-ip");
    for (const a of ["192.0.2.5", "172.16.40.25", "192.0.2.58.1", "", "x".repeat(600)]) expect(isAcceptedAnswer(ip, a), a).toBe(false);
  });

  it("accepts a domain with a trailing dot or defanged, in any case", () => {
    const d = q(headers, "spf-domain");
    for (const a of ["docshare.example.net", "DocShare.Example.Net.", "docshare[.]example[.]net"]) expect(isAcceptedAnswer(d, a), a).toBe(true);
    expect(isAcceptedAnswer(d, "relay.cheapvps.example")).toBe(false);
  });

  it("checks choice questions exactly against the option", () => {
    const spf = q(headers, "spf-result");
    expect(isAcceptedAnswer(spf, "softfail")).toBe(true);
    expect(isAcceptedAnswer(spf, "fail")).toBe(false);
  });

  it("does not refang when a question does not ask for it", () => {
    expect(normalizeAnswer("A[.]B", ["case"])).toBe("a[.]b");
  });

  it("accepts the triage queue's first alert in lower case", () => {
    const first = triage.exercises[0].questions.find((x) => x.answer_type === "text")!;
    expect(isAcceptedAnswer(first, first.accept[0].toLowerCase())).toBe(true);
  });
});

describe("public exercise shape", () => {
  it("never carries answer keys or explanations to the client", () => {
    for (const set of [headers, triage]) {
      const json = JSON.stringify(toPublicExercises(set));
      expect(json).not.toContain('"accept"');
      expect(json).not.toContain('"explanation"');
      for (const e of set.exercises) for (const x of e.questions) expect(json).not.toContain(x.explanation.slice(0, 40));
    }
  });
});
