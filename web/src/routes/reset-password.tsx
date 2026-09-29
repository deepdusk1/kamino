import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    error: typeof search.error === "string" ? search.error : "",
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token, error: linkError } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await authClient.resetPassword({ newPassword: password, token });
      if (r.error) throw new Error(r.error.message ?? "Could not change the password.");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const invalid = !token || Boolean(linkError);
  return (
    <main className="doc-page">
      <section className="doc-card">
        <h1>Choose a new password</h1>
        {done ? (
          <p>
            Your password was changed. You can now sign in from the app or the website.{" "}
            <Link to="/login">Sign in</Link>
          </p>
        ) : invalid ? (
          <p>
            This reset link is missing or has expired. <Link to="/forgot-password">Ask for a new one</Link>.
          </p>
        ) : (
          <form className="suite-form" onSubmit={submit}>
            <label>
              New password
              <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </label>
            {error && <p role="alert" className="error-text">{error}</p>}
            <button type="submit" disabled={busy} className="solid-button">
              {busy ? "Saving…" : "Save password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
