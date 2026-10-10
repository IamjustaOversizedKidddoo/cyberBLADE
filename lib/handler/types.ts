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

export type HandlerContext = {
  kind: "lesson" | "lab";
  lessonId?: string;
  lessonTitle?: string;
  module?: string;
  rank?: number;
  lessonExcerpt?: string;
  labId?: string;
  labTitle?: string;
  objectives?: HandlerObjective[];
  hints?: Record<string, string[]>;
  recentCommands?: string[];
  isChallenge?: boolean;
};

export type HandlerResponse = {
  reply: string;
  commandRecognized?: LearnerCommand;
  hintTierAwarded?: number;
  blocked?: boolean;
  providerUsed: "groq" | "gemini" | "heuristic";
};
