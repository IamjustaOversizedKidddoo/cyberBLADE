import type { DiagramLink, DiagramNode, Point } from "./diagram";

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
    line: "Find the way in before attackers do, with permission and with a report.",
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

// ===== The cinematic sequence (spec 2026-10-08 cinematic §4, owner option 1: an investigation-led story) =====

/** The scenes of the landing sequence, in order. `id` is the scene's heading id. */
export const SCENES = [
  { id: "boot", seq: "01", name: "BOOT" },
  { id: "operator", seq: "02", name: "OPERATOR" },
  { id: "signal", seq: "03", name: "SIGNAL" },
  { id: "trace", seq: "04", name: "TRACE" },
  { id: "analyze", seq: "05", name: "ANALYZE" },
  { id: "defend", seq: "06", name: "DEFEND" },
  { id: "enter", seq: "07", name: "ENTER THE SYSTEM" },
] as const;

/** What the sequence resolves into: the stages of the training system, in product terms. */
export const SYSTEM_STAGES = [
  { id: "learn", label: "LEARN", text: "Lessons that start simple and go all the way to professional depth." },
  { id: "practice", label: "PRACTICE", text: "Terminal checks and labs on simulated machines in your browser." },
  { id: "trace", label: "TRACE", text: "Follow activity across networks and systems." },
  { id: "analyze", label: "ANALYZE", text: "Read logs, packets and processes like evidence." },
  { id: "defend", label: "DEFEND", text: "Detect, contain and harden." },
  { id: "master", label: "MASTER", text: "Timed rank challenges and exam-style practice." },
] as const;

const node = (id: string, x: number, y: number, label: string, morph?: Point[], kind?: DiagramNode["kind"]): DiagramNode => ({ id, x, y, label, kind, morph });

/** SIGNAL: scattered readings (a dot field) settle into a network. */
const FIELD: Record<string, Point> = { a: { x: 12, y: 80 }, b: { x: 30, y: 12 }, c: { x: 46, y: 70 }, d: { x: 63, y: 30 }, e: { x: 78, y: 86 }, f: { x: 90, y: 18 } };
const NET: Record<string, Point> = { a: { x: 10, y: 50 }, b: { x: 30, y: 22 }, c: { x: 32, y: 74 }, d: { x: 56, y: 48 }, e: { x: 78, y: 24 }, f: { x: 82, y: 72 } };
const NET_LABELS: Record<string, string> = { a: "gateway", b: "dns", c: "mail", d: "web", e: "auth", f: "files" };
const NET_LINKS: DiagramLink[] = [
  { from: "a", to: "b" },
  { from: "a", to: "c" },
  { from: "b", to: "d" },
  { from: "c", to: "d" },
  { from: "d", to: "e" },
  { from: "d", to: "f" },
  { from: "e", to: "f", dashed: true },
];
export const SIGNAL_DIAGRAM: Diagram = {
  title: "Scattered readings settle into a map of six connected systems",
  nodes: Object.keys(NET).map((k) => node(k, NET[k].x, NET[k].y, NET_LABELS[k], [FIELD[k]], "signal")),
  links: NET_LINKS,
};

/** ANALYZE: the same network re-arranges into a grid of readings — a dashboard you can read. */
const GRID: Record<string, Point> = { a: { x: 15, y: 30 }, b: { x: 50, y: 30 }, c: { x: 85, y: 30 }, d: { x: 15, y: 74 }, e: { x: 50, y: 74 }, f: { x: 85, y: 74 } };
export const ANALYZE_DIAGRAM: Diagram = {
  title: "The network re-arranged as a grid of readings, one per system",
  nodes: Object.keys(GRID).map((k) => node(k, GRID[k].x, GRID[k].y, NET_LABELS[k], [NET[k]], "host")),
  links: [
    { from: "a", to: "b", shape: "orthogonal" },
    { from: "b", to: "c", shape: "orthogonal" },
    { from: "d", to: "e", shape: "orthogonal" },
    { from: "e", to: "f", shape: "orthogonal" },
    { from: "b", to: "e", dashed: true },
  ],
};

/** TRACE: one route followed hop by hop through the systems, the way an investigator reconstructs it. */
const ROUTE: Record<string, Point> = { r1: { x: 6, y: 78 }, r2: { x: 30, y: 60 }, r3: { x: 54, y: 40 }, r4: { x: 78, y: 26 }, r5: { x: 90, y: 12 } };
const ROUTE_LABELS: Record<string, string> = { r1: "first seen", r2: "proxy", r3: "web", r4: "app", r5: "database" };
export const TRACE_DIAGRAM: Diagram = {
  title: "A route followed hop by hop, from where it was first seen to the database",
  nodes: Object.keys(ROUTE).map((k) => node(k, ROUTE[k].x, ROUTE[k].y, ROUTE_LABELS[k], undefined, "host")),
  links: [
    { from: "r1", to: "r2", shape: "orthogonal" },
    { from: "r2", to: "r3", shape: "orthogonal" },
    { from: "r3", to: "r4", shape: "orthogonal" },
    { from: "r4", to: "r5", shape: "orthogonal" },
  ],
};

/** TRACE: what the investigator writes down at each hop. Ordinary log evidence, one line per system. */
export const TRACE_EVIDENCE = [
  { hop: "r1", time: "09:14:02", note: "Connection logged at the edge firewall" },
  { hop: "r2", time: "09:14:03", note: "Proxy forwards the request and records the source" },
  { hop: "r3", time: "09:14:05", note: "Web server access log: GET /login" },
  { hop: "r4", time: "09:14:07", note: "App log: sign-in for user j.doe" },
  { hop: "r5", time: "09:14:08", note: "Query from the app's service account" },
] as const;

/** ANALYZE: an example day of triage, from everything logged down to the one thing that matters. */
export const TRIAGE = [
  { value: 12480, label: "events logged" },
  { value: 318, label: "alerts raised" },
  { value: 9, label: "worth a closer look" },
  { value: 1, label: "real incident" },
] as const;

/** DEFEND: defence in depth, outermost layer first, each with the control that guards it. */
export const DEFENCE_LAYERS = [
  { name: "EDGE", control: "Firewall rules" },
  { name: "NETWORK", control: "Segmentation" },
  { name: "HOST", control: "Patching and endpoint monitoring" },
  { name: "IDENTITY", control: "Two-step sign-in, least privilege" },
  { name: "DATA", control: "Encryption and backups" },
] as const;
