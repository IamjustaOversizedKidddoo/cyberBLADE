"use client";

import { useState } from "react";
import type { AnswerValue, LearnerQuestion, QuestionSubmissionResult } from "@/lib/lab-engine/soc/query/question-model";
import { submitSocQuestionAnswerAction } from "@/app/(app)/labs/soc/query-actions";

export interface InvestigationQuestionsPanelProps {
  questions: LearnerQuestion[];
  attemptId: string;
  onQuestionAnswered?: (result: QuestionSubmissionResult) => void;
  onApplyReferenceQuery?: (query: string) => void;
}

export function InvestigationQuestionsPanel({
  questions: initialQuestions,
  attemptId,
  onQuestionAnswered,
  onApplyReferenceQuery,
}: InvestigationQuestionsPanelProps) {
  const [questions, setQuestions] = useState<LearnerQuestion[]>(initialQuestions);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [orderings, setOrderings] = useState<Record<string, string[]>>({});
  const [activeHints, setActiveHints] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});

  // Adopt a new non-empty question set from the parent during render (React "adjust state on prop change" pattern).
  const [prevInitialQuestions, setPrevInitialQuestions] = useState(initialQuestions);
  if (initialQuestions !== prevInitialQuestions) {
    setPrevInitialQuestions(initialQuestions);
    if (initialQuestions && initialQuestions.length > 0) setQuestions(initialQuestions);
  }

  const handleTextAnswerChange = (qId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
    setErrorMessages((prev) => ({ ...prev, [qId]: "" }));
  };

  const handleChoiceChange = (qId: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: option }));
  };

  const handleMultiSelectToggle = (qId: string, option: string) => {
    setAnswers((prev) => {
      const current = (prev[qId] as string[] | undefined) || [];
      const updated = current.includes(option)
        ? current.filter((x) => x !== option)
        : [...current, option];
      return { ...prev, [qId]: updated };
    });
  };

  const handleMoveOrderItem = (qId: string, idx: number, direction: "up" | "down") => {
    setOrderings((prev) => {
      const q = questions.find((item) => item.id === qId);
      const currentList = prev[qId] ? [...prev[qId]] : [...(q?.options || [])];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= currentList.length) return prev;

      const temp = currentList[idx];
      currentList[idx] = currentList[targetIdx];
      currentList[targetIdx] = temp;
      return { ...prev, [qId]: currentList };
    });
  };

  const handleSubmit = async (q: LearnerQuestion) => {
    let payload: AnswerValue | undefined = answers[q.id];

    if (q.type === "ordering") {
      payload = orderings[q.id] || q.options || [];
    }

    if (payload === undefined || payload === "") {
      setErrorMessages((prev) => ({ ...prev, [q.id]: "Please provide an answer before submitting." }));
      return;
    }

    setIsSubmitting((prev) => ({ ...prev, [q.id]: true }));
    setErrorMessages((prev) => ({ ...prev, [q.id]: "" }));

    try {
      // Checked on the server against the attempt-pinned dataset (S7).
      const res = await submitSocQuestionAnswerAction(attemptId, q.id, payload);

      // Update question state
      setQuestions((prev) =>
        prev.map((item) => {
          if (item.id === q.id) {
            return {
              ...item,
              status: res.status,
              attemptsLeft: res.attemptsLeft,
              debrief: res.debrief,
              referenceQuery: res.referenceQuery,
            };
          }
          return item;
        }),
      );

      if (onQuestionAnswered) {
        onQuestionAnswered(res);
      }
    } catch (err) {
      setErrorMessages((prev) => ({
        ...prev,
        [q.id]: (err as Error).message || "Submission failed. Please try again.",
      }));
    } finally {
      setIsSubmitting((prev) => ({ ...prev, [q.id]: false }));
    }
  };

  const completedCount = questions.filter((q) => q.status === "correct").length;

  return (
    <div className="flex flex-col h-full bg-surface border-l border-line text-xs w-80 shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-line bg-surface-raised flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-bold text-ink uppercase tracking-wider text-[11px]">
            Investigation Objectives
          </span>
          <span className="text-[10px] text-muted font-mono">
            Verified server-side: {completedCount} / {questions.length} solved
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-xs font-mono font-bold text-[11px] bg-surface text-cyan border border-cyan/40">
          {questions.reduce((sum, q) => (q.status === "correct" ? sum + q.points : sum), 0)} pts
        </span>
      </div>

      {/* Question Cards Container */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 font-mono">
        {questions.map((q, idx) => {
          const isCorrect = q.status === "correct";
          const isLocked = q.status === "locked";
          const isSubmittingNow = isSubmitting[q.id] || false;
          const currentError = errorMessages[q.id];

          return (
            <div
              key={q.id}
              className={`p-3 rounded-xs border transition-colors flex flex-col gap-2 ${
                isCorrect
                  ? "bg-emerald-500/10 border-emerald-500/40"
                  : isLocked
                    ? "bg-danger/10 border-danger/40"
                    : "bg-surface-raised border-line hover:border-line/80"
              }`}
            >
              {/* Question Header & Points */}
              <div className="flex items-start justify-between gap-1">
                <span className="font-bold text-cyan text-[11px]">
                  Q{idx + 1}. {q.type.toUpperCase()}
                </span>
                <span className="text-[10px] text-muted shrink-0">
                  {q.points} pts{q.status === "recorded" ? " • answer saved" : ` • ${q.attemptsLeft} tries`}
                </span>
              </div>

              {/* Question Stem */}
              <div className="text-ink text-xs leading-4">{q.stem}</div>

              {/* Skill Tags */}
              <div className="flex flex-wrap gap-1">
                {q.skillTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] px-1 py-0.2 rounded bg-surface border border-line text-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* INPUT AREA (Based on Type) */}
              {!isCorrect && !isLocked && (
                <div className="flex flex-col gap-2 mt-1">
                  {/* NUMERIC / ENTITY / TIMESTAMP */}
                  {(q.type === "numeric" || q.type === "entity" || q.type === "timestamp") && (
                    <input
                      type={q.type === "numeric" ? "number" : "text"}
                      value={answers[q.id] || ""}
                      onChange={(e) => handleTextAnswerChange(q.id, e.target.value)}
                      placeholder={
                        q.type === "timestamp"
                          ? "YYYY-MM-DDTHH:mm:ssZ"
                          : q.type === "numeric"
                            ? "Enter count..."
                            : "Enter IP, user, domain, or host..."
                      }
                      className="w-full px-2 py-1 bg-surface border border-line rounded-xs text-xs font-mono outline-none focus:border-cyan text-ink"
                    />
                  )}

                  {/* SINGLE CHOICE */}
                  {q.type === "single_choice" && q.options && (
                    <div className="flex flex-col gap-1">
                      {q.options.map((opt) => (
                        <label
                          key={opt}
                          className="flex items-center gap-2 p-1 rounded-xs hover:bg-surface cursor-pointer text-[11px]"
                        >
                          <input
                            type="radio"
                            name={`choice-${q.id}`}
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={() => handleChoiceChange(q.id, opt)}
                            className="accent-cyan"
                          />
                          <span className="truncate">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* MULTI SELECT */}
                  {q.type === "multi_select" && q.options && (
                    <div className="flex flex-col gap-1">
                      {q.options.map((opt) => {
                        const checked = ((answers[q.id] as string[] | undefined) || []).includes(opt);
                        return (
                          <label
                            key={opt}
                            className="flex items-center gap-2 p-1 rounded-xs hover:bg-surface cursor-pointer text-[11px]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleMultiSelectToggle(q.id, opt)}
                              className="accent-cyan"
                            />
                            <span className="truncate">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* ORDERING */}
                  {q.type === "ordering" && (
                    <div className="flex flex-col gap-1">
                      {(orderings[q.id] || q.options || []).map((item, oIdx, arr) => (
                        <div
                          key={item}
                          className="flex items-center justify-between p-1 bg-surface border border-line rounded-xs text-[10px]"
                        >
                          <span className="truncate max-w-[170px]">
                            {oIdx + 1}. {item}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={oIdx === 0}
                              onClick={() => handleMoveOrderItem(q.id, oIdx, "up")}
                              className="px-1 bg-surface-raised border border-line disabled:opacity-30"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={oIdx === arr.length - 1}
                              onClick={() => handleMoveOrderItem(q.id, oIdx, "down")}
                              className="px-1 bg-surface-raised border border-line disabled:opacity-30"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleSubmit(q)}
                      disabled={isSubmittingNow}
                      className="px-3 py-1 rounded-xs border border-cyan bg-cyan/20 hover:bg-cyan/30 text-cyan font-bold text-[11px] uppercase tracking-wider disabled:opacity-50"
                    >
                      {isSubmittingNow ? "Checking..." : "Submit Answer"}
                    </button>
                  </div>
                </div>
              )}

              {/* Status Badges */}
              {q.status === "recorded" && (
                <div className="text-secondary text-[11px] mt-1" role="status">
                  Answer saved. It is marked when you submit the exam; you can change it until then.
                </div>
              )}
              {isCorrect && (
                <div className="text-emerald-400 font-bold text-[11px] flex items-center gap-1 mt-1">
                  ✓ Verified Correct (+{q.points} XP)
                </div>
              )}

              {isLocked && (
                <div className="text-danger font-bold text-[11px] flex items-center gap-1 mt-1">
                  ✕ Attempts Exhausted (Objective Locked)
                </div>
              )}

              {/* Post-Resolution Debrief & Reference Query */}
              {(isCorrect || isLocked) && q.debrief && (
                <div className="bg-surface p-2 rounded-xs border border-line flex flex-col gap-1.5 mt-1 text-[11px]">
                  <span className="font-bold text-muted uppercase text-[10px]">Debrief:</span>
                  <div className="text-ink/90 leading-4">{q.debrief}</div>
                  {q.referenceQuery && (
                    <div className="mt-1 flex flex-col gap-1">
                      <span className="text-[10px] text-cyan font-bold">Reference Query:</span>
                      <div className="p-1 bg-surface-raised border border-line/50 rounded-xs text-[10px] text-cyan break-all">
                        {q.referenceQuery}
                      </div>
                      {onApplyReferenceQuery && (
                        <button
                          type="button"
                          onClick={() => onApplyReferenceQuery(q.referenceQuery!)}
                          className="self-start text-[10px] text-cyan underline hover:text-cyan-bright"
                        >
                          Load Reference Query into Editor
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submission Error Banner */}
              {currentError && (
                <div className="text-danger text-[10px] font-mono leading-4 mt-1">
                  {currentError}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
