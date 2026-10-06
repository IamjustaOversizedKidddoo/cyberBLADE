import { RANKS } from "@/lib/progress/ranks";

export type TrackStatus = "open" | "coming_soon";
export type TrackGroup = "Flagship" | "Defend" | "Attack" | "Build" | "Emerging" | "Governance" | "Leadership";
export type Track = { id: string; title: string; group: TrackGroup; status: TrackStatus };

export const CORE = { id: "core", title: "Shared Core", ranks: RANKS } as const;

const open = (id: string, title: string, group: TrackGroup): Track => ({ id, title, group, status: "open" });
const soon = (id: string, title: string, group: TrackGroup): Track => ({ id, title, group, status: "coming_soon" });

// Spec §3.1 catalogue. Launch tracks first, in roadmap order (docs/curriculum/).
export const TRACKS: Track[] = [
  open("purple", "Cybersecurity (Purple Team)", "Flagship"),
  open("soc", "SOC Analyst", "Defend"),
  open("pentest", "Penetration Tester / VAPT Analyst", "Attack"),
  open("cloud", "Cloud Security", "Build"),
  soon("incident-responder", "Incident Responder", "Defend"),
  soon("threat-hunter", "Threat Hunter", "Defend"),
  soon("detection-engineer", "Detection Engineer", "Defend"),
  soon("digital-forensics", "Digital Forensics", "Defend"),
  soon("malware-analyst", "Malware Analyst", "Defend"),
  soon("red-teamer", "Red Teamer", "Attack"),
  soon("bug-bounty", "Bug Bounty Hunter", "Attack"),
  soon("mobile-security", "Mobile Security", "Attack"),
  soon("appsec", "AppSec / DevSecOps", "Build"),
  soon("network-security", "Network Security Engineer", "Build"),
  soon("iam-engineer", "IAM Engineer", "Build"),
  soon("ot-ics", "OT/ICS Security", "Build"),
  soon("ai-security", "AI Security", "Emerging"),
  soon("threat-intel", "Threat Intelligence", "Emerging"),
  soon("grc", "GRC Analyst", "Governance"),
  soon("auditor", "Security Auditor", "Governance"),
  soon("privacy", "Privacy Analyst", "Governance"),
  soon("architect", "Security Architect", "Leadership"),
  soon("ciso", "Security Manager / CISO path", "Leadership"),
];
