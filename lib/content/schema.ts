import { z } from "zod";

export const TRACK_IDS = ["core", "purple", "soc", "pentest", "cloud"] as const;

const isoDate = z.preprocess(
  // YAML turns an unquoted 2026-09-01 into a Date; store dates as YYYY-MM-DD strings.
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date"),
);

export const lessonFrontmatterSchema = z.object({
  id: z.string().regex(/^(core|purple|soc|pentest|cloud)-r\d-[a-z0-9-]+-\d{2}$/, "expected <track>-r<rank>-<module>-<slug>-NN"),
  title: z.string().min(1),
  track: z.enum(TRACK_IDS),
  rank: z.number().int().min(0).max(5),
  module: z.string().min(1),
  order: z.number().int().min(1),
  estimated_minutes: z.number().int().min(5).max(120),
  objectives_covered: z.array(z.string()),
  mitre: z.array(z.string().regex(/^T\d{4}(\.\d{3})?$/, "expected an ATT&CK id like T1059 or T1059.004")),
  lab: z.string().optional(),
  xp: z.number().int().positive(),
  status: z.enum(["draft", "reviewed", "published"]),
  last_reviewed: isoDate.nullable(),
});

export type LessonFrontmatter = z.infer<typeof lessonFrontmatterSchema>;

export type Lesson = LessonFrontmatter & { slug: string; filePath: string; body: string };
