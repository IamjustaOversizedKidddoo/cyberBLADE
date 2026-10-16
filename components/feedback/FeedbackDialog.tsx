"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedbackAction } from "@/app/(app)/feedback/actions";

type Ref = { lessonId: string; questionId: string } | { examId: string; itemKey: string } | { attemptId: string };
type Kind = "general" | "lesson_check" | "exam_question" | "scenario";

const TITLE: Record<Kind, string> = {
  general: "Send feedback",
  lesson_check: "Report a problem with this question",
  exam_question: "Report a problem with this exam question",
  scenario: "Report a problem with this scenario",
};

/** Native <dialog> (focus trap, Escape and focus return built in). Text is sent as data only. */
export function FeedbackDialog({ kind = "general", contentRef, label, className }: { kind?: Kind; contentRef?: Ref; label?: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname() ?? "/";
  const [message, setMessage] = useState("");
  const [state, setState] = useState<{ status: "idle" | "sending" | "sent" | "error"; text?: string }>({ status: "idle" });

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "sending" });
    try {
      const r = await submitFeedbackAction({ kind, route: pathname, message, ref: contentRef });
      if (r.ok) {
        setState({ status: "sent", text: `Thank you. Reference: ${r.requestId}` });
        setMessage("");
      } else setState({ status: "error", text: `${r.error} Reference: ${r.requestId}` });
    } catch {
      setState({ status: "error", text: "Could not send right now. Please try again later." });
    }
  }

  const id = `fb-${kind}`;
  return (
    <>
      <button type="button" onClick={() => { setState({ status: "idle" }); dialog.current?.showModal(); }} className={className ?? "min-h-[44px] rounded-xs border border-line bg-surface-raised px-3 font-ui text-xs text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-cyan"}>
        {label ?? TITLE[kind]}
      </button>
      <dialog ref={dialog} aria-labelledby={`${id}-title`} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-sm border border-line bg-surface-raised p-0 text-ink backdrop:bg-void/80">
        <form onSubmit={send} className="space-y-3 p-5 font-sans text-sm">
          <h2 id={`${id}-title`} className="font-ui text-base">{TITLE[kind]}</h2>
          <label htmlFor={`${id}-text`} className="block text-secondary">
            What happened, or what should change? Please don&rsquo;t include personal information.
          </label>
          <textarea id={`${id}-text`} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={5} required className="w-full rounded-xs border border-line bg-void p-3 text-ink focus:border-cyan focus-visible:outline-2 focus-visible:outline-cyan" />
          <p className="text-xs text-muted">{message.length}/2000 · sent with this page&rsquo;s address{contentRef ? " and which item it is about" : ""}</p>
          <p role="status" className="min-h-[1.25rem] text-secondary">{state.text}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => dialog.current?.close()} className="min-h-[44px] rounded-xs border border-line px-4 font-ui text-ink hover:bg-surface-hover">Close</button>
            <button type="submit" disabled={state.status === "sending" || !message.trim()} className="min-h-[44px] rounded-xs border border-cyan bg-cyan/20 px-4 font-ui font-semibold text-cyan hover:bg-cyan/30 disabled:opacity-50">
              {state.status === "sending" ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
