"use client";

import { useActionState, useState } from "react";
import { startOperator, type StartState } from "./actions";

const INITIAL: StartState = { errors: {}, handle: "" };

export function StartForm({ next }: { next: string; isHosted?: boolean; inviteOnly?: boolean; notice?: string | null }) {
  const [state, action, pending] = useActionState(startOperator, INITIAL);
  const [draftHandle, setDraftHandle] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return sessionStorage.getItem("cyberblade_draft_handle") || "";
      } catch {
        return "";
      }
    }
    return "";
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDraftHandle(val);
    try {
      sessionStorage.setItem("cyberblade_draft_handle", val);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6" noValidate>
        <input type="hidden" name="next" value={next} />

        {/* Step 1: Handle input */}
        <div className="space-y-3">
          <label htmlFor="handle" className="block text-ink font-sans font-bold text-base tracking-wide">
            ENTER YOUR OPERATOR NAME
          </label>
          <input
            id="handle"
            name="handle"
            value={draftHandle || state.handle}
            onChange={handleInputChange}
            placeholder="e.g. ghost_01 (or leave blank to auto-generate)"
            autoComplete="username"
            autoFocus
            spellCheck={false}
            aria-describedby="handle-help handle-error"
            aria-invalid={state.errors.handle ? true : undefined}
            className="w-full border-2 border-line bg-void px-4 py-3.5 font-mono text-base text-cyan placeholder:text-muted/50 focus:border-cyan outline-none transition-colors"
          />
          <p id="handle-help" className="text-xs text-secondary font-mono">
            Optional callsign (letters, numbers, hyphens or _). Leave blank to auto-generate.
          </p>
          {state.errors.handle && (
            <p id="handle-error" role="alert" className="text-sm font-mono text-danger font-semibold">
              ⚠ {state.errors.handle}
            </p>
          )}
        </div>

        {/* Direct Deploy Button */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="btn-glitch inline-flex min-h-[50px] items-center justify-center border-2 border-cyan bg-cyan/20 px-8 py-3.5 font-ui text-lg font-bold text-cyan hover:bg-cyan hover:text-void disabled:opacity-50 transition-colors cursor-pointer shadow-[0_0_15px_rgba(0,210,211,0.15)]"
          >
            {pending ? "INITIALIZING CONSOLE…" : "ENTER CYBERBLADE →"}
          </button>
          <p className="font-mono text-[11px] text-muted text-center">
            Instant operator session · No passwords or signup needed
          </p>
        </div>
      </form>
    </div>
  );
}
