import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authRequest, setAuthToken, setUnauthorizedHandler } from "@/api/client";
import { api } from "@/api/endpoints";
import { deleteSecret, readSecret, writeSecret } from "./storage";
import { unregisterPushDevice } from "@/lib/push";

const TOKEN_KEY = "kamino.session-token";

/** `needsAge`: signed in, but has not passed the 18+ birthday check yet. */
type Status = "loading" | "signedOut" | "needsAge" | "signedIn";

export type Birthday = { year: number; month: number; day: number };

type Session = {
  status: Status;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, birthday: Birthday) => Promise<void>;
  /** Sends the birthday to the server. Resolves false (and signs out) when the person is too young. */
  confirmAge: (birthday: Birthday) => Promise<boolean>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");

  const clearLocal = useCallback(async () => {
    setAuthToken(null);
    await deleteSecret(TOKEN_KEY);
    queryClient.clear();
    setStatus("signedOut");
  }, [queryClient]);

  // On launch: restore a saved token and check the server still accepts it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await readSecret(TOKEN_KEY);
      if (!saved) return void (!cancelled && setStatus("signedOut"));
      setAuthToken(saved);
      try {
        const boot = await api.bootstrap();
        if (cancelled) return;
        if (!boot.profile) await clearLocal();
        else setStatus(boot.profile.minAgeConfirmed ? "signedIn" : "needsAge");
      } catch (error) {
        if (cancelled) return;
        // Offline at launch keeps the session; only a real "not signed in" answer logs out.
        const unauthorized = (error as { status?: number }).status === 401;
        if (unauthorized) await clearLocal();
        else setStatus("signedIn");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearLocal]);

  // Any later 401 (token revoked, account deleted) drops the user back to the sign-in screen.
  useEffect(() => {
    setUnauthorizedHandler(() => void clearLocal());
    return () => setUnauthorizedHandler(null);
  }, [clearLocal]);

  const finishSignIn = useCallback(
    async (token: string | null) => {
      if (!token) throw new Error("The server did not return a session. Please try again.");
      setAuthToken(token);
      await writeSecret(TOKEN_KEY, token);
      queryClient.clear();
      const boot = await api.bootstrap(); // creates the member profile on first sign-in
      setStatus(boot.profile?.minAgeConfirmed === false ? "needsAge" : "signedIn");
    },
    [queryClient],
  );

  const value = useMemo<Session>(
    () => ({
      status,
      signIn: async (email, password) => {
        const { token } = await authRequest("sign-in/email", { email: email.trim(), password });
        await finishSignIn(token);
      },
      signUp: async (name, email, password, birthday) => {
        const { token } = await authRequest("sign-up/email", { name: name.trim(), email: email.trim(), password });
        if (!token) throw new Error("The server did not return a session. Please try again.");
        setAuthToken(token);
        const answer = await api.confirmAge(birthday);
        if (!answer.ok) {
          await clearLocal(); // the server has already erased the account
          throw new Error("Kamino is for adults aged 18 and over, so we can't create an account for you.");
        }
        await finishSignIn(token);
      },
      confirmAge: async (birthday) => {
        const answer = await api.confirmAge(birthday);
        if (!answer.ok) {
          await clearLocal();
          return false;
        }
        queryClient.clear();
        setStatus("signedIn");
        return true;
      },
      signOut: async () => {
        await unregisterPushDevice().catch(() => undefined);
        await authRequest("sign-out", {}).catch(() => undefined); // best effort: local sign-out must always work
        await clearLocal();
      },
      requestPasswordReset: async (email) => {
        await authRequest("request-password-reset", { email: email.trim(), redirectTo: "/reset-password" });
      },
    }),
    [status, finishSignIn, clearLocal, queryClient],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
