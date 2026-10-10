"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { HandlerContext, HandlerMessage } from "@/lib/handler/types";
import { askHandlerAction } from "@/app/(app)/handler/actions";

type Props = {
  context: HandlerContext;
  operatorHandle?: string;
  defaultOpen?: boolean;
};

const SUGGESTED_CHIPS = [
  { label: "What is this?", text: "what is this?" },
  { label: "Why does it exist?", text: "why?" },
  { label: "Simplify", text: "simplify" },
  { label: "ASCII Diagram", text: "diagram" },
  { label: "Test me", text: "test" },
  { label: "Hint", text: "hint" },
];

export function HandlerDrawer({ context, operatorHandle = "OPERATOR", defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<HandlerMessage[]>(() => [
    {
      role: "assistant",
      content: context.isChallenge
        ? "[COMM LINK SEVERED] Handler assistance is offline during active rank challenges. Rely on your own operational methodology."
        : `Operational Comms established. I am The Handler.\nAsk me anything regarding this module, or use quick commands: \`what is X?\`, \`why?\`, \`simplify\`, \`diagram\`, or \`hint\`.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll message list
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const sendMessage = useCallback(
    (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || isPending) return;

      const userMsg: HandlerMessage = {
        role: "user",
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      startTransition(async () => {
        try {
          const res = await askHandlerAction({
            context,
            history: messages.slice(-10),
            message: trimmed,
          });

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.reply,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        } catch {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "[TRANSMISSION ERROR] Connection to Handler subroutines timed out. Try transmitting again.",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }
      });
    },
    [context, isPending, messages],
  );

  return (
    <>
      {/* Floating Tactical Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="handler-drawer"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 border border-cyan/60 bg-console-deep/95 px-3 py-2 font-ui text-xs tracking-wider text-cyan shadow-[0_0_15px_rgba(15,190,255,0.25)] backdrop-blur transition-all hover:border-cyan hover:bg-cyan hover:text-void sm:bottom-6 sm:right-6"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            context.isChallenge ? "bg-pink" : "bg-cyan animate-pulse"
          }`}
        />
        <span>[THE HANDLER // SOCRATIC AI]</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-void/60 backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Slide-out Drawer Panel */}
      <aside
        id="handler-drawer"
        aria-label="The Handler Socratic AI Panel"
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-line bg-console shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-line bg-console-deep px-4 py-3">
          <div className="flex items-center gap-2 font-display text-sm text-ink">
            <span
              className={`h-2.5 w-2.5 ${
                context.isChallenge ? "bg-pink" : "bg-cyan"
              }`}
            />
            <span className="text-cyan">THE HANDLER</span>
            <span className="text-muted text-xs font-ui">
              {context.isChallenge ? "[OFFLINE // CHALLENGE]" : "[ONLINE]"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close Handler Panel"
            className="border border-line px-2 py-0.5 font-ui text-xs text-muted hover:border-pink hover:text-pink"
          >
            [CLOSE / ESC]
          </button>
        </div>

        {/* Tactical Sub-header (Location & Context) */}
        <div className="flex items-center justify-between border-b border-line/60 bg-void/70 px-4 py-1.5 font-ui text-[11px] text-muted">
          <span>
            TARGET: {context.kind === "lesson" ? context.lessonTitle ?? "Lesson" : context.labTitle ?? "Lab"}
          </span>
          <span className="text-cyan">{operatorHandle}</span>
        </div>

        {/* Quick Suggestion Chips */}
        {!context.isChallenge && (
          <div className="flex flex-wrap gap-1.5 border-b border-line bg-console-raised/50 p-2.5">
            {SUGGESTED_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={isPending}
                onClick={() => sendMessage(chip.text)}
                className="border border-line bg-void/80 px-2.5 py-1 font-ui text-[11px] text-muted transition hover:border-cyan hover:text-cyan disabled:opacity-40"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Message Thread */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 font-mono text-sm">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`space-y-1 ${
                m.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div className="flex items-center gap-2 font-ui text-[11px] text-muted">
                {m.role === "assistant" ? (
                  <>
                    <span className="text-cyan font-bold">[HANDLER]</span>
                    <span>{m.timestamp}</span>
                  </>
                ) : (
                  <div className="ml-auto flex items-center gap-2">
                    <span>{m.timestamp}</span>
                    <span className="text-purple font-bold">[{operatorHandle}]</span>
                  </div>
                )}
              </div>
              <div
                className={`inline-block max-w-[92%] rounded-none border p-3 text-left whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "border-purple/50 bg-purple/10 text-ink"
                    : "border-line bg-void text-ink"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {isPending && (
            <div className="space-y-1 text-left">
              <span className="font-ui text-[11px] text-cyan">[HANDLER THINKING...]</span>
              <div className="inline-block border border-cyan/40 bg-void p-3 text-cyan">
                Decoding query telemetry<span className="neon-cursor">_</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="border-t border-line bg-console-deep p-3"
        >
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              disabled={isPending || context.isChallenge}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                context.isChallenge
                  ? "Comms offline during challenges..."
                  : "Ask Handler: what is X? / why? / diagram / hint..."
              }
              className="flex-1 border border-line bg-void px-3 py-2 font-mono text-xs text-ink placeholder:text-muted/60 focus:border-cyan focus:outline-hidden disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={isPending || !input.trim() || context.isChallenge}
              className="border border-cyan bg-cyan/10 px-4 py-2 font-ui text-xs tracking-wider text-cyan hover:bg-cyan hover:text-void disabled:opacity-40"
            >
              TRANSMIT
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
