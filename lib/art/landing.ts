import type { DiagramLink, DiagramNode } from "./diagram";

type Diagram = { title: string; nodes: DiagramNode[]; links: DiagramLink[] };

/** Every lesson runs this loop. Copy is the learner-facing explanation of each step. */
export const LOOP_STEPS = [
  { id: "briefing", label: "Briefing", text: "The idea in plain words first, then the full technical depth." },
  { id: "check", label: "Terminal Check", text: "Quick questions that prove you understood, with an explanation for every answer." },
  { id: "lab", label: "Lab", text: "Do it yourself in a simulated machine, right in the browser." },
  { id: "debrief", label: "Debrief", text: "What a professional does here, common mistakes, and a real incident." },
] as const;

/** The learning loop as a circuit: four stations around the board, the last wiring back to the first. */
export const LOOP_DIAGRAM: Diagram = {
  title: "How every lesson works: Briefing, Terminal Check, Lab, Debrief, then back to the next Briefing",
  nodes: [
    { id: "briefing", x: 14, y: 22, label: "Briefing", kind: "step" },
    { id: "check", x: 70, y: 22, label: "Terminal Check", kind: "step" },
    { id: "lab", x: 70, y: 78, label: "Lab", kind: "host" },
    { id: "debrief", x: 14, y: 78, label: "Debrief", kind: "step" },
  ],
  links: [
    { from: "briefing", to: "check", shape: "straight" },
    { from: "check", to: "lab", shape: "orthogonal" },
    { from: "lab", to: "debrief", shape: "straight" },
    { from: "debrief", to: "briefing", shape: "orthogonal", dashed: true },
  ],
};

export type LaunchTrackId = "purple" | "soc" | "pentest" | "cloud";

/** One glyph per launch track: the shape of the work, drawn as a tiny schematic. */
export const TRACK_GLYPHS: Record<LaunchTrackId, Diagram & { line: string }> = {
  purple: {
    title: "Two paths through the same systems: one attacking, one defending, crossing in the middle",
    line: "Attack and defend the same systems: red team, blue team, then both at once.",
    nodes: [
      { id: "a1", x: 8, y: 25, label: "recon" },
      { id: "a2", x: 50, y: 18, label: "access" },
      { id: "a3", x: 92, y: 30, label: "objective" },
      { id: "d1", x: 8, y: 78, label: "telemetry" },
      { id: "d2", x: 50, y: 84, label: "detect" },
      { id: "d3", x: 92, y: 70, label: "respond" },
    ],
    links: [
      { from: "a1", to: "a2" },
      { from: "a2", to: "a3" },
      { from: "d1", to: "d2" },
      { from: "d2", to: "d3" },
      { from: "a2", to: "d2", dashed: true },
    ],
  },
  soc: {
    title: "A monitoring trace: a steady signal with one spike that becomes an alert",
    line: "Watch the signals, triage the alerts, investigate and respond.",
    nodes: [
      { id: "s1", x: 6, y: 62, label: "logs", kind: "signal" },
      { id: "s2", x: 28, y: 52, label: "events", kind: "signal" },
      { id: "s3", x: 48, y: 64, label: "baseline", kind: "signal" },
      { id: "s4", x: 66, y: 14, label: "alert", kind: "signal" },
      { id: "s5", x: 94, y: 58, label: "case", kind: "signal" },
    ],
    links: [
      { from: "s1", to: "s2" },
      { from: "s2", to: "s3" },
      { from: "s3", to: "s4" },
      { from: "s4", to: "s5" },
    ],
  },
  pentest: {
    title: "An attack path: from the internet, through a web server and an internal host, to the target",
    line: "Find the way in before attackers do — with permission, and with a report.",
    nodes: [
      { id: "net", x: 8, y: 82, label: "internet" },
      { id: "web", x: 36, y: 56, label: "web", kind: "host" },
      { id: "int", x: 64, y: 34, label: "internal", kind: "host" },
      { id: "goal", x: 92, y: 14, label: "target", kind: "host" },
    ],
    links: [
      { from: "net", to: "web", shape: "orthogonal" },
      { from: "web", to: "int", shape: "orthogonal" },
      { from: "int", to: "goal", shape: "orthogonal" },
    ],
  },
  cloud: {
    title: "A cloud topology: one control hub connected to three regions",
    line: "Secure the infrastructure that runs in someone else's data centre.",
    nodes: [
      { id: "hub", x: 50, y: 50, label: "control", kind: "cloud" },
      { id: "r1", x: 12, y: 18, label: "region a", kind: "cloud" },
      { id: "r2", x: 88, y: 18, label: "region b", kind: "cloud" },
      { id: "r3", x: 50, y: 92, label: "region c", kind: "cloud" },
    ],
    links: [
      { from: "hub", to: "r1", shape: "curve" },
      { from: "hub", to: "r2", shape: "curve" },
      { from: "hub", to: "r3", shape: "curve" },
      { from: "r1", to: "r2", dashed: true },
    ],
  },
};
