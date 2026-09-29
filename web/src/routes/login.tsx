import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, MessageCircle, Sparkles, ShieldCheck } from "lucide-react";
import { authClient, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { KMark } from "@/components/k-mark";
import { BirthdayFields, EMPTY_BIRTHDAY, judgeBirthday, YOUNG_MESSAGE } from "@/components/birthday-fields";
import { confirmMinimumAge } from "@/lib/kamino/extras";
export const Route = createFileRoute("/login")({ component: Login });
function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [birthday, setBirthday] = useState(EMPTY_BIRTHDAY);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // Check the birthday BEFORE creating anything, so nothing is stored for someone under 13.
    const verdict = mode === "up" ? judgeBirthday(birthday) : null;
    if (verdict?.kind === "young") return setError(YOUNG_MESSAGE);
    if (verdict?.kind === "invalid") return setError(verdict.message);
    setBusy(true);
    try {
      const r =
        mode === "up"
          ? await authClient.signUp.email({ name, email, password, callbackURL: "/" })
          : await authClient.signIn.email({ email, password, callbackURL: "/" });
      if (r.error) throw new Error(r.error.message ?? "Could not sign in.");
      if (verdict?.kind === "ok") await confirmMinimumAge({ data: { year: verdict.year, month: verdict.month, day: verdict.day } });
      location.assign("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <img className="auth-art" src="/covers/orbit-vivid.png" alt="" />
        <div className="auth-shade" />
        <Link to="/" className="auth-brand">
          <KMark className="size-11" />
          <span>
            kamino<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="auth-story-copy">
          <span className="pill">
            <Sparkles size={14} /> A space for every side of you
          </span>
          <h1>
            Find your people.
            <br />
            <span>Feel at home.</span>
          </h1>
          <p>
            Your fandoms. Your friendships. Your late-night conversations. All in one little
            universe.
          </p>
          <div className="auth-community-pics">
            {["starlight", "atelier", "pixel-realms", "midnight-stage"].map((c) => (
              <img key={c} src={`/covers/${c}.jpg`} alt="" />
            ))}
            <span>
              Big passions.
              <br />
              Small, meaningful connections.
            </span>
          </div>
        </div>
        <p className="auth-story-footer">
          <MessageCircle size={16} /> Made for the conversations that stay with you.
        </p>
      </section>
      <section className="auth-form-side">
        <Link to="/" className="auth-back">
          ← Back to explore
        </Link>
        <div className="auth-form-card">
          <KMark className="size-14 mb-7" />
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h2>{mode === "in" ? "Welcome back." : "You belong here."}</h2>
          <p className="auth-subtitle">
            {mode === "in"
              ? "Your communities have a place waiting for you."
              : "Create an account and find your corner of the internet."}
          </p>
          <div className="auth-switch" role="tablist" aria-label="Account access">
            <button
              role="tab"
              aria-selected={mode === "in"}
              className={mode === "in" ? "active" : ""}
              onClick={() => {
                setMode("in");
                setError("");
              }}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={mode === "up"}
              className={mode === "up" ? "active" : ""}
              onClick={() => {
                setMode("up");
                setError("");
              }}
            >
              Create account
            </button>
          </div>
          <form className="suite-form" onSubmit={submit}>
            {mode === "up" && (
              <label>
                Display name
                <input
                  autoComplete="nickname"
                  required
                  minLength={2}
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                />
              </label>
            )}
            <label>
              Email address
              <input
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {mode === "up" && <BirthdayFields value={birthday} onChange={setBirthday} />}
            <label>
              Password
              <div className="password-field">
                <input
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  type={show ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {mode === "in" && (
              <Link to="/forgot-password" className="auth-forgot">
                Forgot your password?
              </Link>
            )}
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="solid-button auth-submit">
              {busy ? "Opening your world…" : mode === "in" ? "Come on in" : "Create my account"}
              <ArrowRight size={18} />
            </button>
          </form>
          {import.meta.env.VITE_OAUTH_ENABLED === "true" && (
            <div className="mt-4 grid gap-2">
              {GROK_PROVIDERS.map((p) => (
                <button
                  key={p.providerId}
                  className="quiet-button"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                >
                  Continue with {p.label}
                </button>
              ))}
            </div>
          )}
          <p className="auth-notice">
            <ShieldCheck size={16} /> For people aged 13 and older.
          </p>
          <p className="auth-browse">
            Just looking around? <Link to="/explore">Explore communities</Link>
          </p>
        </div>
        <p className="auth-footnote">A little more community. A little more you.</p>
      </section>
    </main>
  );
}
