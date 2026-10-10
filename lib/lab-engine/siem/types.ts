export type SiemSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type SiemEvent = {
  id: string;
  timestamp: string;
  severity: SiemSeverity;
  eventId: string;
  source: string;
  sourceIp: string;
  destIp?: string;
  user?: string;
  action: string;
  message: string;
  raw: string;
  metadata?: Record<string, string | number>;
};

export type SiemTimelineBucket = {
  timeLabel: string;
  count: number;
  criticalCount: number;
  highCount: number;
};

export type SiemEnv = {
  title: string;
  description: string;
  events: SiemEvent[];
  defaultQuery?: string;
};
