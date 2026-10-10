import type { LabAttempt, LessonProgress } from "@/lib/progress/types";

export type BadgeCategory = "clearance" | "tactical" | "mastery" | "consistency";

export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  category: BadgeCategory;
  code: string;
};

export type EvaluatedBadge = BadgeDefinition & {
  unlocked: boolean;
  unlockedAt?: string;
  progressText?: string;
};

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "initiate",
    title: "Initiate Clearance",
    description: "Enrolled in the CyberBLADE tactical core at Rank 0.",
    category: "clearance",
    code: "CLR-00",
  },
  {
    id: "operator",
    title: "Operator Clearance",
    description: "Promoted to Rank 1 with full systems & network operational capability.",
    category: "clearance",
    code: "CLR-01",
  },
  {
    id: "watcher",
    title: "Watcher Clearance",
    description: "Elevated to Rank 2 (Watcher) clearance following Operation Iron Gate.",
    category: "clearance",
    code: "CLR-02",
  },
  {
    id: "first_blood",
    title: "First Blood",
    description: "Successfully solved your first hands-on lab or lesson verification.",
    category: "tactical",
    code: "TAC-FB",
  },
  {
    id: "packet_surgeon",
    title: "Packet Surgeon",
    description: "Analyzed network captures and dissected packet flows in the lab engine.",
    category: "tactical",
    code: "TAC-PKT",
  },
  {
    id: "root_hunter",
    title: "Root Hunter",
    description: "Audited Linux permission matrices, SUID binaries, and sudo configurations.",
    category: "tactical",
    code: "TAC-LNX",
  },
  {
    id: "powershell_warden",
    title: "PowerShell Warden",
    description: "Investigated Windows Registry persistence run keys and Security Event logs.",
    category: "tactical",
    code: "TAC-WIN",
  },
  {
    id: "clean_run",
    title: "Clean Run",
    description: "Completed an operational lab with zero hint assistance.",
    category: "mastery",
    code: "MAS-CLN",
  },
  {
    id: "iron_gate",
    title: "Iron Gate Survivor",
    description: "Neutralized the multi-domain threat during the Rank 1 Capstone Challenge.",
    category: "mastery",
    code: "MAS-R1C",
  },
  {
    id: "web_sentinel",
    title: "Web Application Sentinel",
    description: "Identified and exploited OWASP web application flaws (SQLi, XSS, IDOR).",
    category: "tactical",
    code: "TAC-WEB",
  },
  {
    id: "watchtower",
    title: "Watchtower Victor",
    description: "Executed full-spectrum web IR and exploitation in Operation Watchtower.",
    category: "mastery",
    code: "MAS-R2C",
  },
  {
    id: "streak_3",
    title: "Tactical Discipline",
    description: "Maintained a 3-day continuous operational streak.",
    category: "consistency",
    code: "CON-S03",
  },
  {
    id: "streak_7",
    title: "Relentless Operator",
    description: "Maintained a 7-day continuous operational streak.",
    category: "consistency",
    code: "CON-S07",
  },
];

export function evaluateBadges(input: {
  operatorRank: number;
  completedLessons: LessonProgress[];
  attempts: LabAttempt[];
  currentStreak: number;
  longestStreak: number;
}): EvaluatedBadge[] {
  const { operatorRank, completedLessons, attempts, currentStreak, longestStreak } = input;

  const completedAttempts = attempts.filter((a) => a.completedAt !== null);
  const completedLabIds = new Set(completedAttempts.map((a) => a.labId));

  const hasPacketLab =
    completedLabIds.has("core-r1-pkt-http-lab-01") ||
    completedLabIds.has("core-r1-pkt-dns-lab-01") ||
    completedLabIds.has("core-r1-pkt-scan-lab-01");

  const hasLinuxLab =
    completedLabIds.has("core-r1-linux-perms-lab-01") ||
    completedLabIds.has("core-r1-linux-proc-lab-01") ||
    completedLabIds.has("core-r1-linux-suid-lab-01");

  const hasWindowsLab =
    completedLabIds.has("core-r1-win-registry-lab-01") ||
    completedLabIds.has("core-r1-win-eventlog-lab-01");

  const hasChallengePassed =
    completedLabIds.has("core-r1-challenge-01") || operatorRank >= 2;

  const hasWebLab =
    completedLabIds.has("core-r2-sqli-lab-01") ||
    completedLabIds.has("core-r2-xss-lab-01") ||
    completedLabIds.has("core-r2-idor-lab-01");

  const hasWatchtowerPassed =
    completedLabIds.has("core-r2-challenge-01") || operatorRank >= 3;

  const hasCleanRun = completedAttempts.some((a) => a.hintsUsed === 0 && a.mode === "practice");

  const bestStreak = Math.max(currentStreak, longestStreak);

  return BADGE_DEFINITIONS.map((badge) => {
    let unlocked = false;
    let unlockedAt: string | undefined;

    switch (badge.id) {
      case "initiate":
        unlocked = true; // Every enrolled operator has Rank 0
        break;
      case "operator":
        unlocked = operatorRank >= 1;
        break;
      case "watcher":
        unlocked = operatorRank >= 2;
        break;
      case "first_blood":
        unlocked = completedLessons.length > 0 || completedAttempts.length > 0;
        break;
      case "packet_surgeon":
        unlocked = hasPacketLab;
        break;
      case "root_hunter":
        unlocked = hasLinuxLab;
        break;
      case "powershell_warden":
        unlocked = hasWindowsLab;
        break;
      case "web_sentinel":
        unlocked = hasWebLab;
        break;
      case "clean_run":
        unlocked = hasCleanRun;
        break;
      case "iron_gate":
        unlocked = hasChallengePassed;
        break;
      case "watchtower":
        unlocked = hasWatchtowerPassed;
        break;
      case "streak_3":
        unlocked = bestStreak >= 3;
        break;
      case "streak_7":
        unlocked = bestStreak >= 7;
        break;
    }

    return {
      ...badge,
      unlocked,
      unlockedAt,
    };
  });
}
