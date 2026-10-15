"use client";

import { useState } from "react";
import { saveSocExamAnswerAction } from "@/app/(app)/labs/soc/exams/actions";
import type { ExamStateView } from "@/lib/lab-engine/soc/exam/service";

type Item = NonNullable<ExamStateView["knowledgeItems"]>[number];

const TYPE_HINT: Record<Item["type"], string> = {
  mcq: "Choose one answer.",
  log: "Read the log, then choose one answer.",
  multi: "Choose every answer that applies.",
  ordering: "Put the options in order with the Move buttons, then save the order.",
};

/**
 * Knowledge exam items. Each change is saved to the server straight away; the response only says
 * "saved", never whether the answer is right.
 */
export function KnowledgeItemsForm({ examId, items, disabled }: { examId: string; items: Item[]; disabled: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => Object.fromEntries(items.map((i) => [i.id, i.savedAnswer ?? (i.type === "ordering" ? [] : [])])));
  const [orders, setOrders] = useState<Record<string, string[]>>(() => Object.fromEntries(items.filter((i) => i.type === "ordering").map((i) => [i.id, i.savedAnswer?.length ? i.savedAnswer : i.options.map((o) => o.id)])));
  const [status, setStatus] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [error, setError] = useState<string | null>(null);

  const answered = items.filter((i) => (answers[i.id]?.length ?? 0) > 0).length;

  async function save(itemId: string, value: string[]) {
    setAnswers((a) => ({ ...a, [itemId]: value }));
    setStatus((s) => ({ ...s, [itemId]: "saving" }));
    try {
      await saveSocExamAnswerAction(examId, itemId, value);
      setStatus((s) => ({ ...s, [itemId]: "saved" }));
      setError(null);
    } catch (e) {
      setStatus((s) => ({ ...s, [itemId]: "error" }));
      setError(e instanceof Error ? e.message : "Could not save that answer.");
    }
  }

  function move(itemId: string, index: number, dir: -1 | 1) {
    const list = [...(orders[itemId] ?? [])];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    [list[index], list[j]] = [list[j], list[index]];
    setOrders((o) => ({ ...o, [itemId]: list }));
    setStatus((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== itemId)));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <p className="font-ui text-sm text-secondary" id="kb-progress">
        {answered} of {items.length} answered. Answers save as you go; nothing is marked until you submit.
      </p>
      {error && (
        <p role="alert" className="rounded-xs border border-danger/40 bg-danger/10 p-3 text-sm text-ink">
          {error}
        </p>
      )}
      <ol className="space-y-6">
        {items.map((item, n) => {
          const chosen = answers[item.id] ?? [];
          const st = status[item.id];
          const textOf = (id: string) => item.options.find((o) => o.id === id)?.text ?? "";
          return (
            <li key={item.id} className="rounded-xs border border-line bg-surface p-4 sm:p-5">
              <fieldset disabled={disabled}>
                <legend className="font-sans text-base leading-relaxed text-ink">
                  <span className="mr-2 font-mono text-sm text-cyan">Q{n + 1}.</span>
                  {item.stem}
                </legend>
                <p className="mt-1 font-sans text-sm text-muted">{TYPE_HINT[item.type]}</p>
                {item.log && (
                  <pre className="mt-3 overflow-x-auto rounded-xs border border-line bg-void p-3 font-mono text-xs leading-relaxed text-ink" tabIndex={0} aria-label="Log excerpt">
                    {item.log}
                  </pre>
                )}

                {(item.type === "mcq" || item.type === "log") && (
                  <div className="mt-3 space-y-2">
                    {item.options.map((o) => (
                      <label key={o.id} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xs border border-line px-3 py-2.5 font-sans text-sm text-ink hover:bg-surface-hover has-[:checked]:border-cyan has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan">
                        <input type="radio" name={`kb-${item.id}`} className="mt-1 accent-cyan" checked={chosen[0] === o.id} onChange={() => save(item.id, [o.id])} />
                        <span>{o.text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {item.type === "multi" && (
                  <div className="mt-3 space-y-2">
                    {item.options.map((o) => (
                      <label key={o.id} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xs border border-line px-3 py-2.5 font-sans text-sm text-ink hover:bg-surface-hover has-[:checked]:border-cyan has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan">
                        <input
                          type="checkbox"
                          className="mt-1 accent-cyan"
                          checked={chosen.includes(o.id)}
                          onChange={(e) => save(item.id, e.target.checked ? [...chosen, o.id] : chosen.filter((x) => x !== o.id))}
                        />
                        <span>{o.text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {item.type === "ordering" && (
                  <div className="mt-3">
                    <ol className="space-y-2" aria-label="Current order">
                      {(orders[item.id] ?? []).map((id, i, list) => (
                        <li key={id} className="flex flex-wrap items-center gap-2 rounded-xs border border-line px-3 py-2 font-sans text-sm text-ink">
                          <span className="font-mono text-xs text-muted" aria-hidden="true">{i + 1}.</span>
                          <span className="min-w-0 flex-1">{textOf(id)}</span>
                          <button type="button" onClick={() => move(item.id, i, -1)} disabled={i === 0} aria-label={`Move "${textOf(id)}" up`} className="min-h-[44px] min-w-[44px] rounded-xs border border-line px-2 text-xs disabled:opacity-40 sm:min-h-[32px]">
                            Up
                          </button>
                          <button type="button" onClick={() => move(item.id, i, 1)} disabled={i === list.length - 1} aria-label={`Move "${textOf(id)}" down`} className="min-h-[44px] min-w-[44px] rounded-xs border border-line px-2 text-xs disabled:opacity-40 sm:min-h-[32px]">
                            Down
                          </button>
                        </li>
                      ))}
                    </ol>
                    <button type="button" onClick={() => save(item.id, orders[item.id] ?? [])} className="mt-3 min-h-[44px] rounded-xs border border-cyan bg-cyan/15 px-4 text-sm font-semibold text-cyan hover:bg-cyan/25">
                      Save this order
                    </button>
                  </div>
                )}
              </fieldset>
              <p className="mt-2 font-ui text-xs text-muted" aria-live="off">
                {st === "saving" ? "Saving…" : st === "saved" ? "Saved" : st === "error" ? "Not saved — try again" : chosen.length ? "Saved earlier" : "Not answered yet"}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
