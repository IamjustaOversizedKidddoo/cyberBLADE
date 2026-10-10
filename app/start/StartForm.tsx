"use client";

import { useActionState } from "react";
import { EthicalUseAgreement } from "@/components/legal/EthicalUseAgreement";
import { HostedAuthSection } from "@/components/auth/HostedAuthSection";
import { startOperator, type StartState } from "./actions";

const INITIAL: StartState = { errors: {}, handle: "" };

export function StartForm({ next, isHosted }: { next: string; isHosted?: boolean }) {
  const [state, action, pending] = useActionState(startOperator, INITIAL);

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-6" noValidate>
        <input type="hidden" name="next" value={next} />

        <div className="space-y-2">
          <label htmlFor="handle" className="block text-ink">
            Choose your operator handle
          </label>
          <input
            id="handle"
            name="handle"
            defaultValue={state.handle}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="handle-help handle-error"
            aria-invalid={state.errors.handle ? true : undefined}
            className="w-full border border-line bg-void px-3 py-2 font-mono text-ink focus:border-cyan"
          />
          <p id="handle-help" className="text-sm text-muted">
            3–20 characters: letters, numbers or _. This is the only thing we store about you.
          </p>
          {state.errors.handle && (
            <p id="handle-error" role="alert" className="text-sm text-pink">
              {state.errors.handle}
            </p>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto border border-line p-4" tabIndex={0} aria-label="Ethical use agreement">
          <EthicalUseAgreement />
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-3 text-ink">
            <input
              type="checkbox"
              name="agree"
              className="mt-1.5 size-4 accent-cyan"
              aria-describedby="agree-error"
              aria-invalid={state.errors.agree ? true : undefined}
            />
            I have read and agree to the ethical use agreement
          </label>
          {state.errors.agree && (
            <p id="agree-error" role="alert" className="text-sm text-pink">
              {state.errors.agree}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="btn-glitch border border-cyan px-6 py-2 text-lg text-cyan hover:bg-cyan hover:text-void disabled:opacity-50"
        >
          {pending ? "Starting…" : "Start"}
        </button>
      </form>

      {isHosted && <HostedAuthSection nextPath={next} />}
    </div>
  );
}
