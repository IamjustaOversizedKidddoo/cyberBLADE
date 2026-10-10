"use client";

import { useState } from "react";
import { signInWithMagicLink, signInWithOAuth } from "@/lib/supabase/auth-actions";

type Props = {
  nextPath: string;
};

export function HostedAuthSection({ nextPath }: Props) {
  const [email, setEmail] = useState("");
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

      {/* Google OAuth */}
      <button
        type="button"
        onClick={() => void signInWithOAuth("google", nextPath)}
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
