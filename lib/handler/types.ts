export type HandlerRole = "system" | "user" | "assistant";

export type HandlerMessage = {
  role: HandlerRole;
  content: string;
  timestamp?: string;
};

export type LearnerCommand =
  | "what_is"
  | "why"
  | "explain_again"
  | "simplify"
  | "deep_dive"
  | "example"
  | "diagram"
  | "test"
  | "interview"
  | "revision"
  | "recap"
  | "hint"
  | "custom";

export type HandlerObjective = {
  id: string;
  prompt: string;
  solved: boolean;
};

/** SOC-mode context, built only on the server from the learner's own work (no ground truth). */
export type SocPromptContext = {
  scenarioTitle: string;
  totalAlerts: number;
  decidedAlertsCount: number;
  currentAlert?: { id: string; source: string; ruleName: string; severity: string; summary: string; relatedAsset?: string; relatedUser?: string };
  myDecision?: { disposition: string; severity: string; escalate: boolean; rationale: string };
  recentQueries: string[];
  recentLookups: string[];
  reportExcerpt?: string;
  myDetectionRules?: Array<{ id: string; title: string; severity: string; query: string }>;
};

export type HandlerContext = {
  /** "soc" is set only by the server-side SOC action; the general Handler action accepts lesson | lab. */
  kind: "lesson" | "lab" | "soc";
  soc?: SocPromptContext;
  lessonId?: string;
  lessonTitle?: string;
  module?: string;
  rank?: number;
  lessonExcerpt?: string;
  labId?: string;
  labTitle?: string;
  objectives?: HandlerObjective[];
  hints?: Record<string, string[]>;
  activeObjectiveId?: string;
  activeTier?: number;
  unlockedHintText?: string;
  supportedCommands?: string[];
  recentCommands?: string[];
  isChallenge?: boolean;
};

export type HandlerResponse = {
  reply: string;
  commandRecognized?: LearnerCommand;
  hintTierAwarded?: number;
  blocked?: boolean;
  providerUsed: "groq" | "gemini" | "heuristic";
  isOfflineFallback?: boolean;
  quotaExceeded?: boolean;
};
