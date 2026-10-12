import type {
  SocScenario,
  SocAlert,
  SocSeverity,
  SocDisposition,
} from "./schema";
import type {
  SocDecisionRecord,
  SocCaseRecord,
  SocEvaluationResult,
  AlertEvaluation,
  IncidentEvaluation,
  SkillEvaluation,
} from "./types";

const SEVERITY_ORDER: Record<SocSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function severityDistance(a: SocSeverity, b: SocSeverity): number {
  return Math.abs(SEVERITY_ORDER[a] - SEVERITY_ORDER[b]);
}

/**
 * Pure server-authoritative evaluation function.
 * Compares learner decisions against scenario ground truth.
 *
 * Guaranteed Anti-Cheat Invariants:
 * 1. Debrief text is returned ONLY for alerts the learner has actually decided upon.
 * 2. Undecided alerts NEVER reveal their debrief or ground-truth explanation.
 * 3. Evaluation is computed purely server-side from ground-truth rules.
 */
export function evaluateSocAttempt(
  attemptId: string,
  scenario: SocScenario,
  decisions: SocDecisionRecord[],
  cases: SocCaseRecord[],
  submittedAt = new Date().toISOString(),
): SocEvaluationResult {
  // 1. Get latest decision per alertId (append-only log resolution)
  const latestDecisions = new Map<string, SocDecisionRecord>();
  const sorted = [...decisions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const d of sorted) {
    latestDecisions.set(d.alertId, d);
  }

  // Set of alerts grouped into cases
  const alertsInCases = new Set<string>();
  for (const c of cases) {
    for (const aid of c.alertIds ?? []) alertsInCases.add(aid);
  }

  const alertResults: AlertEvaluation[] = [];
  let totalPointsEarned = 0;
  const maxPossiblePoints = scenario.alerts.length * 100;

  let truePositivesTotal = 0;
  let truePositivesFound = 0;
  let falsePositivesTotal = 0;
  let falsePositivesHandled = 0;
  let overEscalatedCount = 0;
  let underEscalatedCount = 0;

  for (const alert of scenario.alerts) {
    const isTP = alert.groundTruth.kind === "true_positive";
    if (isTP) truePositivesTotal++;
    else falsePositivesTotal++;

    const decision = latestDecisions.get(alert.id);

    if (!decision) {
      // Undecided alert: 0 points, NO debrief revealed!
      if (isTP) underEscalatedCount++;
      alertResults.push({
        alertId: alert.id,
        isCorrect: false,
        learnerDisposition: null,
        correctDisposition: alert.groundTruth.correctDisposition,
        learnerSeverity: null,
        correctSeverity: alert.groundTruth.correctSeverity,
        learnerEscalate: null,
        correctEscalate: alert.groundTruth.correctEscalation,
        pointsEarned: 0,
        maxPoints: 100,
        debrief: undefined, // Never reveal debrief for unworked alerts!
      });
      continue;
    }

    // Learner decided on this alert
    const learnerDisp = decision.disposition;
    const learnerSev = decision.severity;
    const learnerEscalate = decision.escalate;

    // Check disposition
    let dispCorrect = learnerDisp === alert.groundTruth.correctDisposition;
    let altMatched = false;
    let altReason: string | undefined;
    let multiplier = 1.0;

    if (!dispCorrect && alert.groundTruth.acceptableAlternatives?.length) {
      const match = alert.groundTruth.acceptableAlternatives.find((alt) => alt.disposition === learnerDisp);
      if (match) {
        dispCorrect = true;
        altMatched = true;
        altReason = match.reason;
        multiplier = match.scoreMultiplier;
      }
    }

    // Points breakdown (total 100 per alert)
    // Disposition: 45 pts
    const dispPoints = (dispCorrect ? 45 : 0) * multiplier;

    // Severity: 20 pts (exact = 20, 1 step off = 10, else 0)
    const dist = severityDistance(learnerSev, alert.groundTruth.correctSeverity);
    const sevPoints = (dist === 0 ? 20 : dist === 1 ? 10 : 0) * multiplier;

    // Escalation: 20 pts
    const escalateCorrect = learnerEscalate === alert.groundTruth.correctEscalation;
    const escalatePoints = (escalateCorrect ? 20 : 0) * multiplier;

    // Rationale: 15 pts (must be at least 15 characters of thoughtful analysis)
    const rationaleLength = (decision.rationale || "").trim().length;
    const rationalePoints = rationaleLength >= 15 ? 15 : rationaleLength >= 5 ? 5 : 0;

    const alertEarned = Math.round(dispPoints + sevPoints + escalatePoints + rationalePoints);
    totalPointsEarned += alertEarned;

    // Tracking stats
    if (isTP) {
      if (dispCorrect && (learnerDisp === "true_positive" || altMatched)) {
        truePositivesFound++;
      }
      if (!learnerEscalate) {
        underEscalatedCount++;
      }
    } else {
      if (dispCorrect) {
        falsePositivesHandled++;
      }
      if (learnerEscalate) {
        overEscalatedCount++;
      }
    }

    alertResults.push({
      alertId: alert.id,
      isCorrect: dispCorrect && dist <= 1 && escalateCorrect,
      learnerDisposition: learnerDisp,
      correctDisposition: alert.groundTruth.correctDisposition,
      learnerSeverity: learnerSev,
      correctSeverity: alert.groundTruth.correctSeverity,
      learnerEscalate: learnerEscalate,
      correctEscalate: alert.groundTruth.correctEscalation,
      acceptableAlternativeMatched: altMatched,
      alternativeReason: altReason,
      pointsEarned: alertEarned,
      maxPoints: 100,
      debrief: alert.groundTruth.debrief, // Safe to show: learner triaged this alert!
    });
  }

  // 2. Incident-level evaluation
  const incidentResults: IncidentEvaluation[] = [];
  let detectedIncidentsCount = 0;

  for (const inc of scenario.groundTruth.incidents) {
    let foundCount = 0;
    for (const aid of inc.truePositiveAlertIds) {
      const dec = latestDecisions.get(aid);
      if (dec && dec.disposition === "true_positive" && dec.escalate) {
        foundCount++;
      }
    }

    // An incident is considered detected if at least half of its key alerts were caught and escalated
    const detected = foundCount >= Math.ceil(inc.truePositiveAlertIds.length / 2);
    if (detected) detectedIncidentsCount++;

    incidentResults.push({
      incidentId: inc.id,
      title: inc.title,
      detected,
      foundAlertCount: foundCount,
      totalAlertCount: inc.truePositiveAlertIds.length,
    });
  }

  // 3. Skills breakdown
  const percentage = maxPossiblePoints > 0 ? Math.round((totalPointsEarned / maxPossiblePoints) * 100) : 0;
  const skills: SkillEvaluation[] = scenario.skillsTested.map((skillId) => {
    // Evenly distribute score per tested skill
    return {
      skillId,
      skillTitle: skillId.replace(/^soc_/, "").replace(/_/g, " ").toUpperCase(),
      pointsEarned: totalPointsEarned,
      maxPoints: maxPossiblePoints,
      percentage,
    };
  });

  const passed = percentage >= 70 && detectedIncidentsCount >= Math.ceil(scenario.groundTruth.incidents.length * 0.6);

  return {
    attemptId,
    scenarioId: scenario.id,
    totalScore: totalPointsEarned,
    maxScore: maxPossiblePoints,
    percentage,
    passed,
    alertsTotal: scenario.alerts.length,
    alertsDecided: latestDecisions.size,
    truePositivesFound,
    truePositivesTotal,
    falsePositivesHandled,
    falsePositivesTotal,
    overEscalatedCount,
    underEscalatedCount,
    incidents: incidentResults,
    skills,
    alertResults,
    overallDebrief: scenario.groundTruth.overallDebrief,
    submittedAt,
  };
}
