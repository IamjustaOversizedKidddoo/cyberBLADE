import { checksSchema, type CheckSet } from "@/lib/content/checks";
import type { Lesson } from "@/lib/content/schema";
import type { Generator } from "@/lib/generators";
import { dir, file } from "@/lib/lab-engine/terminal/build";
import { labSchema, type LoadedLab } from "@/lib/lab-engine/lab-schema";
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
  return {
    world: {
      hostname: "lab",
      user: "op",
      home: "/home/op",
      root: dir({ home: dir({ op: dir({ "flag.txt": file(`${flag}\n`), "word.txt": file(`${word}\n`) }, { owner: "op" }) }) }),
    },
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

export const LESSONS = [lesson("core-r0-test-alpha-01", 1, LAB.id), lesson("core-r0-test-beta-01", 2)];

export function fakeContent(): ContentSource {
  return {
    getLesson: async (id) => LESSONS.find((l) => l.id === id) ?? null,
    getLessons: async (filter = {}) => LESSONS.filter((l) => filter.rank === undefined || l.rank === filter.rank),
    loadChecks: async (id) => checks(id),
    loadLab: async (id) => {
      const lab = [LAB, CHALLENGE_LAB].find((l) => l.id === id);
      if (!lab) throw new Error(`unknown lab ${id}`);
      return lab;
    },
    listLabs: async () => [LAB, CHALLENGE_LAB],
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
export function readFromWorld(world: { root: unknown }, name: "flag.txt" | "word.txt"): string {
  const root = world.root as { children: { home: { children: { op: { children: Record<string, { content: string }> } } } } };
  return root.children.home.children.op.children[name].content.trim();
}
