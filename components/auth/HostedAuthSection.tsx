"use client";

import { useState } from "react";
import { signInWithMagicLink, signInWithOAuth } from "@/lib/supabase/auth-actions";

type Props = {
  nextPath: string;
  /** Closed beta: new learners enter their invite code before choosing a sign-in method. */
  inviteOnly?: boolean;
};

export function HostedAuthSection({ nextPath, inviteOnly }: Props) {
  const [email, setEmail] = useState("");
  const [invite, setInvite] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("next", nextPath);
      if (invite.trim()) formData.set("invite", invite.trim());
      const res = await signInWithMagicLink(formData);
      if (res.error) {
        setError(res.error);
      } else if (res.message) {
        setStatus(res.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-line/60">
      <div className="flex items-center gap-2 font-mono text-xs text-muted uppercase tracking-wider">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
        <span>HOSTED IDENTITY // SINGLE SIGN-ON</span>
      </div>

      {inviteOnly && (
        <div className="space-y-1">
          <label htmlFor="sso-invite" className="block font-sans text-sm font-semibold text-ink">
            Invite code (first sign-in only)
          </label>
          <p id="sso-invite-hint" className="font-sans text-sm text-secondary">
            CyberBLADE is in a closed beta. New learners enter the code from their invitation, then sign in below in this same browser. Returning learners can leave it empty.
          </p>
          <input
            id="sso-invite"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            aria-describedby="sso-invite-hint"
            className="w-full min-h-[44px] border border-line bg-void px-3 font-mono text-sm uppercase text-ink outline-none focus:border-cyan focus-visible:outline-2 focus-visible:outline-cyan"
          />
        </div>
      )}

      {/* Google OAuth */}
      <button
        type="button"
        onClick={async () => {
          setError(null);
          const res = await signInWithOAuth("google", nextPath, invite.trim() || undefined);
          if (res && "error" in res) setError(res.error);
        }}
        className="w-full flex items-center justify-center gap-2 border border-line bg-console px-4 py-2.5 font-mono text-sm text-ink hover:border-cyan hover:text-cyan transition-colors"
      >
        <span>[G]</span>
        <span>CONTINUE WITH GOOGLE OAUTH</span>
      </button>

      {/* Magic link form */}
      <form onSubmit={handleMagicLink} className="space-y-2">
        <label htmlFor="sso-email" className="block text-xs font-mono text-muted uppercase">
          OR SEND SECURE MAGIC LINK:
        </label>
        <div className="flex gap-2">
          <input
            id="sso-email"
            type="email"
            placeholder="operator@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 border border-line bg-void px-3 py-1.5 font-mono text-sm text-ink outline-none focus:border-cyan"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="border border-cyan bg-cyan/10 px-4 py-1.5 font-mono text-xs text-cyan hover:bg-cyan/20 disabled:opacity-40 transition-colors uppercase"
          >
            {loading ? "SENDING..." : "DISPATCH"}
          </button>
        </div>
      </form>

      {status && (
        <p role="status" className="font-mono text-xs text-cyan">
          ✓ {status}
        </p>
      )}

      {error && (
        <p role="alert" className="font-mono text-xs text-pink">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
