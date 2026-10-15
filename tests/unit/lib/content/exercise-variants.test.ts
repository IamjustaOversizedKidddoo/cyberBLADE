/** L1-A-17 regression: free-text exercise checkers accept legitimate variants and still reject wrong answers. */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { isAcceptedAnswer, parseExercises } from "@/lib/content/exercises";

function question(file: string, id: string) {
  const set = parseExercises(fs.readFileSync(file, "utf8"), file);
  const q = set.exercises.flatMap((e) => e.questions).find((x) => x.id === id);
  if (!q) throw new Error(`${id} not in ${file}`);
  return q;
}

describe("L1-A-17: exercise answer variants", () => {
  it("UTC time accepts common ways of writing 19:42 UTC, and rejects the local time", () => {
    const q = question("content/tracks/soc/l1/m02-triage/04-alert-anatomy.exercises.yaml", "utc-time");
    for (const ok of ["19:42", "19:42 UTC", "19:42 utc", "19:42:00", "19:42Z", " 19:42 "]) expect(isAcceptedAnswer(q, ok), ok).toBe(true);
    for (const bad of ["15:42", "15:42 UTC", "19:24", "", "19"]) expect(isAcceptedAnswer(q, bad), bad).toBe(false);
  });

  it("parent process accepts the file name with or without .exe, and rejects other processes", () => {
    const q = question("content/tracks/soc/l1/m06-endpoint/21-process-creation.exercises.yaml", "parent-of-js");
    for (const ok of ["mailclient.exe", "MailClient.exe", "mailclient"]) expect(isAcceptedAnswer(q, ok), ok).toBe(true);
    for (const bad of ["wscript.exe", "explorer.exe", "3300", ""]) expect(isAcceptedAnswer(q, bad), bad).toBe(false);
  });
});
