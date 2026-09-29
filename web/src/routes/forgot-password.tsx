import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
      // The server answers the same way whether or not the address exists.
      if (r.error) throw new Error(r.error.message ?? "Could not send the email.");
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="doc-page">
      <section className="doc-card">
        <h1>Forgot your password?</h1>
        {sent ? (
          <p>
            If an account exists for <strong>{email}</strong>, a reset link is on its way. It works
            for one hour. <Link to="/login">Back to sign in</Link>
          </p>
        ) : (
          <>
            <p>Enter your account email and we will send you a link to choose a new password.</p>
            <form className="suite-form" onSubmit={submit}>
              <label>
                Email address
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              {error && <p role="alert" className="error-text">{error}</p>}
              <button type="submit" disabled={busy} className="solid-button">
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
