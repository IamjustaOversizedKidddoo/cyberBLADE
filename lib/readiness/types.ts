export type GradingBand = "Weak" | "Needs review" | "Good" | "Strong" | "Exam Ready";

export type ObjectiveReadiness = {
  id: string;
  summary: string;
  targetRank: number;
  covered: boolean;
  lessonId?: string;
  lessonTitle?: string;
};

export type CertReadiness = {
  certId: string;
  name: string;
  examCode: string;
  scorePercent: number;
  band: GradingBand;
  completedObjectives: number;
  totalObjectives: number;
  objectives: ObjectiveReadiness[];
  disclaimer?: string;
  decayApplied?: boolean;
};
