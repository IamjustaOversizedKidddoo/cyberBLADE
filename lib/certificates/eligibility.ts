import "server-only";

import type { Ctx } from "@/lib/progress/service";
import type { TrackCertificateEligibility } from "./types";

export type TrackDefinition = {
  trackId: string;
  trackTitle: string;
  level: string;
  criteriaDescription: string;
};

export const CERTIFICATE_TRACKS: TrackDefinition[] = [
  {
    trackId: "core",
    trackTitle: "Shared Core: Foundations & Systems",
    level: "Operator",
    criteriaDescription: "Complete foundational lessons and achieve a passing score on the Rank 0 → 1 Capstone Challenge.",
  },
  {
    trackId: "core",
    trackTitle: "Shared Core: Advanced Defensive Analysis",
    level: "Watcher",
    criteriaDescription: "Achieve Operator rank and successfully pass the Rank 1 → 2 Capstone Challenge.",
  },
  {
    trackId: "soc",
    trackTitle: "SOC Analyst: Frontline Incident Triage",
    level: "Tier 1 Analyst",
    criteriaDescription: "Pass the comprehensive SOC Level 1 Practical Performance-Based Exam with a score of 70% or higher.",
  },
  {
    trackId: "pentest",
    trackTitle: "Penetration Testing: Junior Penetration Tester",
    level: "eJPT Practical",
    criteriaDescription: "Pass the comprehensive Penetration Testing Level 1 Practical Performance-Based Exam with a score of 70% or higher.",
  },
];

/**
 * Server-authoritative check for track completion criteria. Never trusts client input.
 */
export async function evaluateTrackEligibility(
  ctx: Ctx,
  userId: string,
  trackId: string,
  level: string,
): Promise<{ eligible: boolean; reason?: string; snapshot: Record<string, unknown> }> {
  if (trackId === "core") {
    if (level === "Operator") {
      const passed = await ctx.repo.hasPassedChallenge(userId, 0);
      if (!passed) {
        return {
          eligible: false,
          reason: "Rank 0 Capstone Challenge has not been completed or passed.",
          snapshot: {},
        };
      }
      return {
        eligible: true,
        snapshot: { rank: 1, challengeRank: 0, verifiedAt: ctx.now().toISOString() },
      };
    }

    if (level === "Watcher") {
      const passed = await ctx.repo.hasPassedChallenge(userId, 1);
      if (!passed) {
        return {
          eligible: false,
          reason: "Rank 1 Capstone Challenge has not been completed or passed.",
          snapshot: {},
        };
      }
      return {
        eligible: true,
        snapshot: { rank: 2, challengeRank: 1, verifiedAt: ctx.now().toISOString() },
      };
    }
  }

  if (trackId === "soc") {
    if (level === "Tier 1 Analyst") {
      const [outcomes, attempts] = await Promise.all([
        ctx.repo.listSocExamOutcomeReports(userId),
        ctx.repo.listSocExamAttempts(userId),
      ]);

      const passedOutcome = outcomes.find((o) => o.passed);
      const passedAttempt = attempts.find(
        (a) => a.status === "submitted" && a.result && a.result.scorePercent >= 70,
      );

      if (!passedOutcome && !passedAttempt) {
        return {
          eligible: false,
          reason: "SOC Level 1 practical exam has not been passed with ≥70% score.",
          snapshot: {},
        };
      }

      const score = passedAttempt?.result?.scorePercent ?? (passedOutcome ? 100 : 0);
      return {
        eligible: true,
        snapshot: {
          tier: "Tier 1",
          scorePercent: score,
          verifiedAt: ctx.now().toISOString(),
        },
      };
    }
  }

  if (trackId === "pentest") {
    if (level === "eJPT Practical") {
      const attempts = await ctx.repo.listPentestExamAttempts(userId);
      const passedAttempt = attempts.find(
        (a) => a.status === "submitted" && a.result && a.result.scorePercent >= 70,
      );

      if (!passedAttempt) {
        return {
          eligible: false,
          reason: "Penetration Testing Level 1 practical exam has not been passed with ≥70% score.",
          snapshot: {},
        };
      }

      const score = passedAttempt.result!.scorePercent;
      return {
        eligible: true,
        snapshot: {
          track: "pentest",
          level: "eJPT Practical",
          scorePercent: score,
          verifiedAt: ctx.now().toISOString(),
        },
      };
    }
  }

  return {
    eligible: false,
    reason: `Track '${trackId}' with level '${level}' is not recognized or not available.`,
    snapshot: {},
  };
}

/**
 * Returns the status of all available tracks for the learner:
 * whether eligible, reason if not, and any existing certificate already issued.
 */
export async function listLearnerTrackEligibilities(
  ctx: Ctx,
  userId: string,
): Promise<TrackCertificateEligibility[]> {
  const existingCerts = await ctx.repo.listCertificates(userId);
  const certMap = new Map(existingCerts.map((c) => [`${c.trackId}:${c.level}`, c]));

  return Promise.all(
    CERTIFICATE_TRACKS.map(async (t) => {
      const issued = certMap.get(`${t.trackId}:${t.level}`) ?? null;
      if (issued) {
        return {
          trackId: t.trackId,
          trackTitle: t.trackTitle,
          level: t.level,
          eligible: true,
          criteriaDescription: t.criteriaDescription,
          issuedCertificate: issued,
        };
      }

      const evalResult = await evaluateTrackEligibility(ctx, userId, t.trackId, t.level);
      return {
        trackId: t.trackId,
        trackTitle: t.trackTitle,
        level: t.level,
        eligible: evalResult.eligible,
        reason: evalResult.reason,
        criteriaDescription: t.criteriaDescription,
        issuedCertificate: null,
      };
    }),
  );
}
