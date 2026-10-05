import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {useQuery} from '@tanstack/react-query';
import { Eye, EyeOff, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { authClient, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { BirthdayFields, EMPTY_BIRTHDAY, judgeBirthday, YOUNG_MESSAGE } from "@/components/birthday-fields";
import { AuthCard, AuthFrame, AuthTitle, Field, FormError } from "@/components/home/auth-ui";
import { StepHeader } from "@/components/home/step-header";
import { FilterPills, GradientButton, OutlineButton } from "@/components/k";
import { confirmMinimumAge } from "@/lib/kamino/extras";
import {getSignInCapabilities} from '@/lib/kamino/identity-v9';
import {CaptchaField} from '@/components/captcha-field';
import { safeRedirect } from '@/lib/auth/safe-redirect';

/**
 * Onboarding step 1: create an account (name, email, birthday 13+ check, password) or sign in.
 * The Welcome screen opens it with `?mode=up` (Get Started) or `?mode=in` (I already have an account).
 * New accounts land on Home, which sends them to the rest of onboarding.
 */
export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { mode?: "in" | "up"; redirect?: string } => ({
    ...(search.mode === 'up' || search.mode === 'in' ? { mode: search.mode } : {}),
    ...(typeof search.redirect === 'string' ? { redirect: safeRedirect(search.redirect) } : {}),
  }),
  head: () => ({ meta: [{ title: "Sign in · Kamino" }] }),
  component: Login,
});

function Login() {
  const search = Route.useSearch();
  const next = safeRedirect(search.redirect);
  const [mode, setMode] = useState<"in" | "up">(search.mode ?? "in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [birthday, setBirthday] = useState(EMPTY_BIRTHDAY);
  const [verificationSent, setVerificationSent] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [backupCode,setBackupCode]=useState(false);
  const [captchaToken,setCaptchaToken]=useState('');
  const [phone,setPhone]=useState('');const [phoneCode,setPhoneCode]=useState('');const [phoneSent,setPhoneSent]=useState(false);
  const capabilities=useQuery({queryKey:['signInCapabilities'],queryFn:()=>getSignInCapabilities()});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // Check the birthday BEFORE creating anything, so nothing is stored for someone under 13.
    const verdict = mode === "up" ? judgeBirthday(birthday) : null;
    if (verdict?.kind === "young") return setError(YOUNG_MESSAGE);
    if (verdict?.kind === "invalid") return setError(verdict.message);
    setBusy(true);
    try {
      if (twoFactor) {
        const answer = backupCode ? await authClient.twoFactor.verifyBackupCode({code:authCode}) : await authClient.twoFactor.verifyTotp({ code: authCode });
        if (answer.error) throw new Error(answer.error.message ?? 'Incorrect authenticator code.');
        location.assign(next);
        return;
      }
      const r =
        mode === "up"
          ? await authClient.signUp.email({ name, email, password, callbackURL: next }, {headers:captchaToken?{'x-captcha-response':captchaToken}:{}})
          : await authClient.signIn.email({ email, password, callbackURL: next });
      if (r.error) throw new Error(r.error.message ?? "Could not sign in.");
      if ((r.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) { setTwoFactor(true); setBusy(false); return; }
      if (mode === 'up' && !(r.data as { token?: string | null } | null)?.token) { setVerificationSent(true); setBusy(false); return; }
      if (verdict?.kind === "ok") await confirmMinimumAge({ data: { year: verdict.year, month: verdict.month, day: verdict.day } });
      // A full page load, so every part of the site picks up the new session.
      location.assign(next);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const switchMode = (next: "in" | "up") => {
    setMode(next);
    setError("");
    setTwoFactor(false);
    setVerificationSent(false);
  };
  const up = mode === "up";

  return (
    <AuthFrame>
      <main id="main">
        <StepHeader back step={up ? 1 : undefined} />

        <div className="relative mx-auto w-full max-w-[480px] px-4 lg:pt-6">
          <AuthTitle
            lead={up ? "Create Your " : "Welcome "}
            highlight={up ? "Account" : "Back"}
            text={
              up
                ? "A calm place for your communities. Free to join, no pushy notifications."
                : "Good to see you again. Sign in to get back to your people."
            }
            className={up ? "mt-2.5" : "mt-5"}
          />

          <AuthCard className="mt-4">
            <FilterPills
              fill
              label="Account access"
              className="mx-0 px-0 py-0 lg:py-0"
              items={[
                { key: "up", label: "Create account", icon: <Sparkles />, tone: "violet" },
                { key: "in", label: "Sign in", icon: <LogIn />, tone: "blue" },
              ]}
              value={mode}
              onChange={(k) => switchMode(k as "in" | "up")}
            />

            <form className="flex flex-col gap-4" onSubmit={submit} noValidate={false}>
              {verificationSent && <p role="status" className="rounded-tile bg-tint-violet p-3 text-sm">Check your email for the confirmation link, then sign in. You will confirm your birthday after verification.</p>}
              {twoFactor && <><Field label={backupCode?'Backup code':'Authenticator code'} inputMode={backupCode?'text':'numeric'} autoComplete="one-time-code" value={authCode} onChange={e => setAuthCode(e.target.value)} maxLength={backupCode?30:6} placeholder={backupCode?'Single-use backup code':'Six-digit code'} required/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={backupCode} onChange={e=>{setBackupCode(e.target.checked);setAuthCode('');}}/>Use a backup code</label></>}
              {up && (
                <Field
                  label="Display name"
                  autoComplete="nickname"
                  required
                  minLength={2}
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                />
              )}
              <Field
                label="Email"
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Field
                label="Password"
                autoComplete={up ? "new-password" : "current-password"}
                type={show ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="k-focus grid size-11 place-items-center rounded-full text-muted hover:text-ink"
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              {!up && (
                <Link
                  to="/forgot-password"
                  className="k-focus -mt-2 self-end rounded-full px-1 py-1.5 text-[13px] font-bold text-violet hover:underline"
                >
                  Forgot your password?
                </Link>
              )}
              {up && <BirthdayFields value={birthday} onChange={setBirthday} />}
              {up&&capabilities.data?.captchaSiteKey&&<CaptchaField siteKey={capabilities.data.captchaSiteKey} onToken={setCaptchaToken}/>}

              {error && <FormError>{error}</FormError>}
              <GradientButton type="submit" gradient="hero" size="lg" arrow full disabled={busy}>
                {busy ? "Opening your world…" : twoFactor ? 'Verify code' : up ? "Create My Account" : "Sign In"}
              </GradientButton>
            </form>

            {(capabilities.data?.google||capabilities.data?.apple)&&<div className="grid gap-2">{(['google','apple'] as const).filter(provider=>capabilities.data?.[provider]).map(provider=><OutlineButton key={provider} full onClick={async()=>{const response=await authClient.signIn.social({provider,callbackURL:next});if(response.error)setError(response.error.message??'Provider sign-in failed.');}}>Continue with {provider==='apple'?'Apple':'Google'}</OutlineButton>)}</div>}
            {capabilities.data?.phone&&<div className="space-y-3 rounded-tile border border-border p-3"><p className="font-bold">Sign in with a phone number</p><Field label="Phone number" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+16045551234"/>{phoneSent&&<Field label="SMS code" inputMode="numeric" value={phoneCode} onChange={e=>setPhoneCode(e.target.value)} maxLength={6}/>}<OutlineButton full onClick={async()=>{setError('');try{if(phoneSent){const response=await authClient.phoneNumber.verify({phoneNumber:phone,code:phoneCode});if(response.error)throw new Error(response.error.message);if((response.data as {twoFactorRedirect?:boolean}|null)?.twoFactorRedirect){setTwoFactor(true);return;}location.assign(next);}else{const response=await authClient.phoneNumber.sendOtp({phoneNumber:phone});if(response.error)throw new Error(response.error.message);setPhoneSent(true);}}catch(e){setError(e instanceof Error?e.message:'Phone sign-in failed.');}}}>{phoneSent?'Verify SMS code':'Send SMS code'}</OutlineButton></div>}

            {import.meta.env.VITE_OAUTH_ENABLED === "true" && (
              <div className="grid gap-2">
                {GROK_PROVIDERS.map((p) => (
                  <OutlineButton
                    key={p.providerId}
                    size="md"
                    className="h-11 w-full"
                    onClick={() => signIn(p.providerId, { callbackURL: next })}
                  >
                    Continue with {p.label}
                  </OutlineButton>
                ))}
              </div>
            )}

            <p className="text-center text-[12px] leading-[1.5] font-semibold text-subtle">
              By continuing you agree to the{" "}
              <Link to="/terms" className="k-focus text-violet hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="k-focus text-violet hover:underline">
                Privacy policy
              </Link>
              .
            </p>
            <p className="-mt-2 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-muted">
              <ShieldCheck className="size-4 text-green-ink" aria-hidden /> For people aged 13 and older.
            </p>
          </AuthCard>

          <div className="mt-2 flex flex-col items-center">
            <button
              type="button"
              onClick={() => switchMode(up ? "in" : "up")}
              className="k-focus inline-flex min-h-11 items-center rounded-full px-3 text-[15px] font-semibold text-violet hover:underline"
            >
              {up ? "I already have an account" : "New here? Create an account"}
            </button>
            <p className="text-[13.5px] text-muted">
              Just looking around?{" "}
              <Link to="/explore" className="k-focus font-bold text-violet hover:underline">
                Explore communities
              </Link>
            </p>
          </div>
        </div>
      </main>
    </AuthFrame>
  );
}
