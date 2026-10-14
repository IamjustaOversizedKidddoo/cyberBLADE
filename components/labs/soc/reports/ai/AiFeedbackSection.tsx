"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { AiCriterionView, AiResultView } from "@/lib/lab-engine/soc/ai-grading/compose";
import type { SocReportData } from "@/lib/lab-engine/soc/reports/types";
import {
  getSocAiConsentAction,
  getSocAiResultAction,
  requestSocAiHumanReviewAction,
  setSocAiConsentAction,
} from "@/app/(app)/labs/soc/ai-actions";
import { AiStatusChip } from "./AiStatusChip";
import { EvidenceHighlight } from "./EvidenceHighlight";
import { HowAiFeedbackWorks } from "./HowAiFeedbackWorks";

const POLL_MS = [3000, 5000, 8000, 13000, 20000];
const MAX_POLLS = 14; // ~3 minutes, then the learner can refresh manually

function summarize(view: AiResultView): string {
  const ready = view.criteria.filter((c) => c.displayStatus !== "pending").length;
  return ready === view.criteria.length ? "AI writing feedback is ready." : `AI writing feedback: ${ready} of ${view.criteria.length} criteria ready.`;
}

function CriterionRow({ c, report }: { c: AiCriterionView; report: SocReportData }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const panelId = useId();
  const hasBand = c.band !== undefined && (c.displayStatus === "graded" || c.displayStatus === "preview");

  return (
    <li className="space-y-2 rounded-xs border border-line bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-ink">{c.title}</h4>
          {hasBand && (
            <p className="mt-0.5 text-[12px] text-muted">
              <span className="text-ink">{c.bandLabel}</span> · level {c.band} of 3
              {c.confidence ? ` · ${c.confidence} confidence` : ""}
              {c.source && c.source !== "ai" ? " · confirmed by a reviewer" : ""}
            </p>
          )}
          {c.reason && <p className="mt-0.5 text-[12px] text-muted">{c.displayStatus === "not_graded" ? `Not graded: ${c.reason}` : c.reason}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <AiStatusChip status={c.displayStatus} />
          {hasBand && <span className="text-[11px] text-muted">{c.countsInTotal ? `Counts (${(c.weight * 100).toFixed(1)}% weight)` : "Does not count"}</span>}
        </div>
      </div>

      {hasBand && c.feedback && (
        <div className="space-y-1.5 font-sans text-[13px] leading-relaxed">
          <p className="text-muted">{c.feedback.summary}</p>
          {c.feedback.strengths.length > 0 && (
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-success">What worked</p>
              <ul className="ml-4 list-disc text-ink">
                {c.feedback.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {c.feedback.improvements.length > 0 && (
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-warning">To improve</p>
              <ul className="ml-4 list-disc text-ink">
                {c.feedback.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {c.verifiedSpans.length > 0 && (
            <>
              <button
                type="button"
                aria-expanded={showEvidence}
                aria-controls={panelId}
                onClick={() => setShowEvidence((v) => !v)}
                className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xs px-1 font-mono text-[12px] font-bold text-cyan underline underline-offset-2 transition-colors duration-150 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan sm:min-h-0"
              >
                {showEvidence ? "Hide" : "Show"} the {c.verifiedSpans.length === 1 ? "sentence" : `${c.verifiedSpans.length} sentences`} this is based on
              </button>
              <div id={panelId} hidden={!showEvidence}>
                {showEvidence && <EvidenceHighlight report={report} spans={c.verifiedSpans} />}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function AiFeedbackSection({ submissionId, report }: { submissionId: string; report: SocReportData }) {
  const [view, setView] = useState<AiResultView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [reviewState, setReviewState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [reviewMessage, setReviewMessage] = useState("");
  const [consent, setConsent] = useState<boolean | null>(null);
  const [consentMessage, setConsentMessage] = useState("");
  const polls = useRef(0);
  const consentId = useId();

  const load = useCallback(async () => {
    try {
      const v = await getSocAiResultAction(submissionId);
      setView(v);
      setLoadError(null);
      setAnnouncement(summarize(v));
      return v;
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load AI feedback.");
      return null;
    }
  }, [submissionId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const v = await load();
      if (cancelled || !v) return;
      if (v.criteria.some((c) => c.displayStatus === "pending") && polls.current < MAX_POLLS) {
        timer = setTimeout(tick, POLL_MS[Math.min(polls.current, POLL_MS.length - 1)]);
        polls.current++;
      }
    };
    void tick();
    void getSocAiConsentAction()
      .then((c) => !cancelled && setConsent(c.granted))
      .catch(() => !cancelled && setConsent(null));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  const requestReview = async () => {
    setReviewState("sending");
    try {
      const r = await requestSocAiHumanReviewAction(submissionId);
      setReviewState("done");
      setReviewMessage(r.status === "created" ? "Human review requested. A reviewer will check the AI feedback on this report." : "You already requested a human review for this report.");
      await load();
    } catch (e) {
      setReviewState("error");
      setReviewMessage(e instanceof Error ? e.message : "Could not request a review.");
    }
  };

  const toggleConsent = async (next: boolean) => {
    const previous = consent;
    setConsent(next);
    try {
      await setSocAiConsentAction(next);
      setConsentMessage(next ? "Thank you. You can turn this off at any time." : "Turned off. Your reports will not be used for calibration from now on.");
    } catch (e) {
      setConsent(previous);
      setConsentMessage(e instanceof Error ? e.message : "Could not save your choice.");
    }
  };

  const pending = view?.criteria.some((c) => c.displayStatus === "pending");
  const anyBand = view?.criteria.some((c) => c.band !== undefined && (c.displayStatus === "graded" || c.displayStatus === "preview"));
  const reviewed = view?.humanReviewRequested || reviewState === "done";

  return (
    <section aria-labelledby="ai-feedback-heading" className="flex flex-col gap-3 font-mono text-xs">
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <h3 id="ai-feedback-heading" className="text-[13px] font-bold uppercase tracking-wider text-ink">
          Writing feedback <span className="text-muted">(AI-assisted)</span>
        </h3>
        {view && (
          <span className="rounded-xs border border-line bg-surface-subtle px-2 py-0.5 text-[11px] text-muted">
            {view.mode === "live" ? `Counts toward total (${(view.aiWeightCounted * 100).toFixed(1)}% weight)` : view.mode === "preview" ? "Preview: does not change your score" : view.mode === "shadow" ? "Not shown during testing" : "Off"}
            {view.calibrated ? "" : " · not yet calibrated"}
          </span>
        )}
      </div>

      {loadError && (
        <div role="alert" className="rounded-xs border border-danger/40 bg-danger/10 p-3 text-danger">
          {loadError}{" "}
          <button type="button" onClick={() => void load()} className="ml-1 min-h-[44px] cursor-pointer font-bold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan sm:min-h-0">
            Try again
          </button>
        </div>
      )}

      {!view && !loadError && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xs border border-line bg-surface motion-safe:animate-pulse" />
          ))}
        </div>
      )}

      {view && (
        <>
          {view.mode === "live" && (
            <p className="rounded-xs border border-line bg-surface p-3 text-[12px] text-muted">
              Total with writing criteria: <span className="font-bold text-ink">{view.displayedTotal.toFixed(1)}%</span> (automatic checks alone: {view.deterministicTotal.toFixed(1)}%).
            </p>
          )}
          {pending && <p className="text-[12px] text-muted">Some writing feedback is still being prepared. This page updates on its own.</p>}

          <ul className="space-y-2">
            {view.criteria.map((c) => (
              <CriterionRow key={c.criterionId} c={c} report={report} />
            ))}
          </ul>

          <HowAiFeedbackWorks view={view} />

          {anyBand && (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-sans text-[13px] text-muted">Think the AI got your writing wrong? A person can check it.</p>
              <button
                type="button"
                onClick={() => void requestReview()}
                disabled={reviewed || reviewState === "sending"}
                aria-describedby="ai-review-status"
                className="min-h-[44px] cursor-pointer rounded-xs border border-line bg-surface px-3 py-2 font-bold text-ink transition-colors duration-150 hover:border-cyan/60 hover:text-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reviewState === "sending" ? "Requesting…" : reviewed ? "Human review requested" : "Request human review"}
              </button>
            </div>
          )}
          <p id="ai-review-status" role="status" aria-live="polite" className={`text-[12px] ${reviewState === "error" ? "text-danger" : "text-muted"}`}>
            {reviewMessage}
          </p>

          {consent !== null && (
            <div className="rounded-xs border border-line bg-surface-subtle p-3">
              <div className="flex items-start gap-3">
                <input
                  id={consentId}
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => void toggleConsent(e.target.checked)}
                  aria-describedby={`${consentId}-help`}
                  className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                />
                <div>
                  <label htmlFor={consentId} className="cursor-pointer font-bold text-ink">
                    Help check the AI against human graders
                  </label>
                  <p id={`${consentId}-help`} className="mt-0.5 font-sans text-[13px] leading-relaxed text-muted">
                    Lets us use an anonymized copy of your submitted reports (no name, handle or email) so people can score them and compare with the AI. Off unless you turn it on; you can turn it off any time.
                  </p>
                </div>
              </div>
              <p role="status" aria-live="polite" className="mt-1 text-[12px] text-muted">
                {consentMessage}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
