"use client";

/**
 * Last-resort error page (errors in the root layout). Shows only a reference that matches the
 * server log entry; never the message or stack.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#020408", color: "#f3f6f9", fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 16px" }}>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p>The page could not be shown. Your work is saved on the server.</p>
          {error.digest && <p style={{ color: "#9cb0c4" }}>Reference: {error.digest}</p>}
          <button type="button" onClick={() => reset()} style={{ minHeight: 44, padding: "0 16px", marginTop: 16 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
