import { checksSchema, optionOrder, type CheckSet } from "@/lib/content/checks";
import type { Lesson } from "@/lib/content/schema";
import type { Generator } from "@/lib/generators";
import { dir, file } from "@/lib/lab-engine/terminal/build";
import { labSchema, type LoadedLab } from "@/lib/lab-engine/lab-schema";
import type { LabEnv } from "@/lib/lab-engine/env";
import type { OperatorStore } from "@/lib/identity/operator-store";
import type { Operator } from "@/lib/identity/types";
import type { ContentSource, Ctx } from "@/lib/progress/service";
import { MemoryProgressRepo } from "@/lib/progress/memory-repo";

export class MemoryOperatorStore implements OperatorStore {
  operators = new Map<string, Operator>();
  async get(id: string) {
    return this.operators.get(id) ?? null;
  }
  async create(input: { handle: string; ethicsAcceptedAt: string }) {
    const op: Operator = { id: `op-${this.operators.size + 1}`, rank: 0, createdAt: "2026-10-07T00:00:00Z", ...input };
    this.operators.set(op.id, op);
    return op;
  }
  async setRank(id: string, rank: number) {
    const op = this.operators.get(id);
    if (op) op.rank = rank;
  }
}

const lesson = (id: string, order: number, lab?: string): Lesson => ({
  id,
  title: `Lesson ${order}`,
  track: "core",
  rank: 0,
  module: "test",
  order,
  estimated_minutes: 20,
  objectives_covered: [],
  mitre: [],
  lab,
  xp: 100,
  status: "draft",
  last_reviewed: null,
  slug: id,
  filePath: `${id}.mdx`,
  body: "",
});

const checks = (lessonId: string): CheckSet =>
  checksSchema.parse({
    lesson: lessonId,
    questions: ["q1", "q2", "q3"].map((id) => ({
      id,
      prompt: `${id}?`,
      objectives: ["secplus:1.2"],
      options: [
        { text: "right", correct: true, explanation: "yes" },
        { text: "wrong", correct: false, explanation: "no" },
      ],
    })),
  });

/** Flag is written into the world, so tests "find" it the way a learner would. */
const flagGen: Generator = (rng) => {
  const flag = `NEON{${rng.hex(12)}}`;
  const word = rng.pick(["alpha", "bravo", "charlie", "delta"]);
  const world = {
    hostname: "lab",
    user: "op",
    home: "/home/op",
    root: dir({ home: dir({ op: dir({ "flag.txt": file(`${flag}\n`), "word.txt": file(`${word}\n`) }, { owner: "op" }) }) }),
  };
  return {
    env: { kind: "terminal" as const, world },
    answers: { flag, word },
  };
};

export const LAB: LoadedLab = {
  ...labSchema.parse({
    id: "test-lab-01",
    title: "Test lab",
    type: "terminal",
    track: "core",
    rank: 0,
    estimated_minutes: 10,
    briefing: "briefing.md",
    dataset: { generator: "flag_gen", params: {} },
    objectives: [
      { id: "o1", prompt: "flag?", check: { kind: "flag", answer_from: "generator.flag" } },
      { id: "o2", prompt: "word?", check: { kind: "flag", answer_from: "generator.word" } },
    ],
    xp: 150,
  }),
  briefingText: "Simulated machine.",
};

export const CHALLENGE_LAB: LoadedLab = {
  ...labSchema.parse({
    id: "test-challenge-01",
    title: "Test challenge",
    type: "terminal",
    track: "core",
    rank: 0,
    estimated_minutes: 45,
    briefing: "briefing.md",
    dataset: { generator: "flag_gen", params: {} },
    objectives: [
      { id: "o1", prompt: "flag?", check: { kind: "flag", answer_from: "generator.flag" } },
      { id: "o2", prompt: "word?", check: { kind: "flag", answer_from: "generator.word" } },
    ],
    xp: 300,
    challenge: { rank: 0, time_limit_minutes: 45, cooldown_minutes: 30 },
  }),
  briefingText: "Night shift.",
};

export const CHALLENGE_R1_LAB: LoadedLab = {
  ...labSchema.parse({
    id: "test-challenge-r1-01",
    title: "Test Rank 1 challenge",
    type: "terminal",
    track: "core",
    rank: 1,
    estimated_minutes: 30,
    briefing: "briefing.md",
    dataset: { generator: "flag_gen", params: {} },
    objectives: [
      { id: "o1", prompt: "flag?", check: { kind: "flag", answer_from: "generator.flag" } },
      { id: "o2", prompt: "word?", check: { kind: "flag", answer_from: "generator.word" } },
    ],
    xp: 400,
    challenge: { rank: 1, time_limit_minutes: 30, cooldown_minutes: 30 },
  }),
  briefingText: "Operation Iron Gate.",
};

export const LESSONS = [lesson("core-r0-test-alpha-01", 1, LAB.id), lesson("core-r0-test-beta-01", 2)];
export const LESSONS_R1 = [{ ...lesson("core-r1-test-alpha-01", 1), rank: 1 }];

export function fakeContent(): ContentSource {
  const allLabs = [LAB, CHALLENGE_LAB, CHALLENGE_R1_LAB];
  const allLessons = [...LESSONS, ...LESSONS_R1];
  return {
    getLesson: async (id) => allLessons.find((l) => l.id === id) ?? null,
    getLessons: async (filter = {}) => allLessons.filter((l) => filter.rank === undefined || l.rank === filter.rank),
    loadChecks: async (id) => checks(id),
    loadLab: async (id) => {
      const lab = allLabs.find((l) => l.id === id);
      if (!lab) throw new Error(`unknown lab ${id}`);
      return lab;
    },
    listLabs: async () => allLabs,
    generators: { flag_gen: flagGen },
  };
}

export function makeCtx(now = new Date("2026-10-07T10:00:00Z")) {
  const operators = new MemoryOperatorStore();
  const clock = { now };
  const ctx: Ctx = { repo: new MemoryProgressRepo(), operators, content: fakeContent(), now: () => clock.now };
  return { ctx, operators, clock };
}

/** Reads an answer out of the world the browser got, like a learner would. */
export function readFromWorld(envOrWorld: LabEnv | { root: unknown }, name: "flag.txt" | "word.txt"): string {
  if ("kind" in envOrWorld && envOrWorld.kind === "terminal") {
    const root = envOrWorld.world.root as unknown as { children: { home: { children: { op: { children: Record<string, { content: string }> } } } } };
    return root.children.home.children.op.children[name].content.trim();
  }
  if ("root" in envOrWorld) {
    const root = envOrWorld.root as unknown as { children: { home: { children: { op: { children: Record<string, { content: string }> } } } } };
    return root.children.home.children.op.children[name].content.trim();
  }
  throw new Error("readFromWorld called on non-terminal env");
}

/** Where the correct option ("right", option 0 in the file) is shown to this learner. */
export const RIGHT = (userId: string, lessonId: string, questionId: string) => optionOrder(userId, lessonId, questionId, 2).indexOf(0);
export const WRONG = (userId: string, lessonId: string, questionId: string) => 1 - RIGHT(userId, lessonId, questionId);
