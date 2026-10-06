import { checksSchema, gradeCheck, parseChecks, toPublicChecks, type CheckSet } from "@/lib/content/checks";

const option = (text: string, correct = false) => ({ text, correct, explanation: `Because ${text}.` });
const question = (id: string) => ({
  id,
  prompt: `Question ${id}?`,
  objectives: ["secplus:1.2"],
  options: [option(`${id}-right`, true), option(`${id}-wrong`), option(`${id}-other`)],
});
const valid = { lesson: "core-r0-test-first-01", questions: [question("q1"), question("q2"), question("q3")] };

test("accepts 3 well-formed questions", () => {
  expect(checksSchema.safeParse(valid).success).toBe(true);
});

test.each([
  ["2 questions", { ...valid, questions: valid.questions.slice(0, 2) }],
  ["6 questions", { ...valid, questions: ["a", "b", "c", "d", "e", "f"].map(question) }],
  ["empty objectives", { ...valid, questions: [{ ...question("q1"), objectives: [] }, question("q2"), question("q3")] }],
  ["malformed objective id", { ...valid, questions: [{ ...question("q1"), objectives: ["Security+ 1.2"] }, question("q2"), question("q3")] }],
  ["two correct options", { ...valid, questions: [{ ...question("q1"), options: [option("a", true), option("b", true)] }, question("q2"), question("q3")] }],
  ["no correct option", { ...valid, questions: [{ ...question("q1"), options: [option("a"), option("b")] }, question("q2"), question("q3")] }],
  ["empty explanation", { ...valid, questions: [{ ...question("q1"), options: [{ text: "a", correct: true, explanation: "" }, option("b")] }, question("q2"), question("q3")] }],
  ["one option", { ...valid, questions: [{ ...question("q1"), options: [option("a", true)] }, question("q2"), question("q3")] }],
  ["duplicate question ids", { ...valid, questions: [question("q1"), question("q1"), question("q3")] }],
])("rejects %s", (_, input) => {
  expect(checksSchema.safeParse(input).success).toBe(false);
});

test("parseChecks reads YAML and validates", () => {
  const yaml = `lesson: core-r0-test-first-01
questions:
${["q1", "q2", "q3"]
  .map(
    (id) => `  - id: ${id}
    prompt: "Q?"
    objectives: ["secplus:1.2"]
    options:
      - { text: "yes", correct: true, explanation: "right" }
      - { text: "no", correct: false, explanation: "wrong" }`,
  )
  .join("\n")}
`;
  expect(parseChecks(yaml, "x.checks.yaml").questions).toHaveLength(3);
  expect(() => parseChecks("lesson: x\nquestions: []", "bad.checks.yaml")).toThrow(/bad\.checks\.yaml/);
});

describe("public view and grading", () => {
  const set = checksSchema.parse(valid) as CheckSet;

  test("public view hides the answer key", () => {
    const pub = toPublicChecks(set);
    expect(pub[0]).toEqual({ id: "q1", prompt: "Question q1?", options: ["q1-right", "q1-wrong", "q1-other"] });
    const json = JSON.stringify(pub);
    expect(json).not.toContain("correct");
    expect(json).not.toContain("Because");
  });

  test("grading returns correctness and every explanation", () => {
    expect(gradeCheck(set, "q2", 0)).toEqual({
      correct: true,
      explanations: ["Because q2-right.", "Because q2-wrong.", "Because q2-other."],
    });
    expect(gradeCheck(set, "q2", 1).correct).toBe(false);
  });

  test("unknown question or out-of-range option throws", () => {
    expect(() => gradeCheck(set, "nope", 0)).toThrow();
    expect(() => gradeCheck(set, "q1", 3)).toThrow();
    expect(() => gradeCheck(set, "q1", -1)).toThrow();
    expect(() => gradeCheck(set, "q1", 1.5)).toThrow();
  });
});
