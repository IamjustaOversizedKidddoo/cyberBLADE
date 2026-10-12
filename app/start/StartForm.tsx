"use client";

import { useActionState, useEffect, useState } from "react";
import { EthicalUseAgreement } from "@/components/legal/EthicalUseAgreement";
import { HostedAuthSection } from "@/components/auth/HostedAuthSection";
import { startOperator, type StartState } from "./actions";

const INITIAL: StartState = { errors: {}, handle: "" };

export function StartForm({ next, isHosted }: { next: string; isHosted?: boolean }) {
  const [state, action, pending] = useActionState(startOperator, INITIAL);
  const [draftHandle, setDraftHandle] = useState("");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("cyberblade_draft_handle");
      if (saved && !state.handle) {
        setDraftHandle(saved);
      }
    } catch {
      // ignore
    }
  }, [state.handle]);

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
    <div className="space-y-8">
      {/* 3-Step Induction Indicator */}
      <div className="grid grid-cols-3 gap-2 border-b border-line/60 pb-6 font-mono text-xs">
        <div className="border-l-2 border-cyan pl-2 text-ink">
          <span className="text-cyan block font-bold">01 // CALLSIGN</span>
          <span className="text-muted text-[11px] hidden sm:block">Operator identity</span>
        </div>
        <div className="border-l-2 border-line pl-2 text-muted">
          <span className="text-secondary block font-bold">02 // CHARTER</span>
          <span className="text-muted text-[11px] hidden sm:block">Ethical scope</span>
        </div>
        <div className="border-l-2 border-line pl-2 text-muted">
          <span className="text-secondary block font-bold">03 // DEPLOY</span>
          <span className="text-muted text-[11px] hidden sm:block">Console access</span>
        </div>
      </div>

      <form action={action} className="space-y-6" noValidate>
        <input type="hidden" name="next" value={next} />

        {/* Step 1: Handle input */}
        <div className="space-y-2">
          <label htmlFor="handle" className="block text-ink font-ui font-semibold text-sm">
            Choose your operator handle
          </label>
          <input
            id="handle"
            name="handle"
            value={draftHandle || state.handle}
            onChange={handleInputChange}
            autoComplete="username"
            spellCheck={false}
            aria-describedby="handle-help handle-error"
            aria-invalid={state.errors.handle ? true : undefined}
            className="w-full border border-line bg-void px-3 py-2.5 font-mono text-ink focus:border-cyan outline-none transition-colors"
          />
          <p id="handle-help" className="text-xs text-secondary">
            3–20 characters: letters, numbers or _. This is the only thing we store about you.
          </p>
          {state.errors.handle && (
            <p id="handle-error" role="alert" className="text-sm font-mono text-danger font-semibold">
              ⚠ {state.errors.handle}
            </p>
          )}
        </div>

        {/* Step 2: Ethical agreement box */}
        <div className="space-y-2">
          <span className="block text-xs font-mono text-muted uppercase tracking-wider">
            STEP 02 // RULES OF ENGAGEMENT
          </span>
          <div
            className="max-h-72 overflow-y-auto border border-line bg-surface-subtle p-4 rounded-xs"
            tabIndex={0}
            aria-label="Ethical use agreement"
          >
            <EthicalUseAgreement />
          </div>
        </div>

        {/* Explicit consent checkbox */}
        <div className="space-y-2">
          <label className="flex items-start gap-3 text-ink cursor-pointer">
            <input
              type="checkbox"
              name="agree"
              className="mt-1 size-4 accent-cyan"
              aria-describedby="agree-error"
              aria-invalid={state.errors.agree ? true : undefined}
            />
            <span className="font-sans text-sm text-secondary">
              I have read and agree to the ethical use agreement
            </span>
          </label>
          {state.errors.agree && (
            <p id="agree-error" role="alert" className="text-sm font-mono text-danger font-semibold">
              ⚠ {state.errors.agree}
            </p>
          )}
        </div>

        {/* Step 3: Deploy button */}
        <button
          type="submit"
          disabled={pending}
          className="btn-glitch inline-flex min-h-[44px] items-center justify-center border-2 border-cyan bg-cyan/10 px-8 py-2.5 font-ui text-lg text-cyan hover:bg-cyan hover:text-void disabled:opacity-50 transition-colors"
        >
          {pending ? "Starting…" : "Start"}
        </button>
      </form>

      {isHosted && <HostedAuthSection nextPath={next} />}
    </div>
  );
}
