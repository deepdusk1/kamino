import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { api } from "@/api/endpoints";
import { readSecret, writeSecret } from "@/auth/storage";

const key = (userId: string) => `kamino.welcome-done.${userId}`;

/** Remembers on this phone that the person has seen the welcome screen. */
export async function markWelcomeDone(userId: string): Promise<void> {
  await writeSecret(key(userId), "1");
}

/**
 * Call once from the Home tab. The first time a brand-new account (no communities yet) lands on Home,
 * the welcome screen opens so they can pick interests and join a few communities.
 */
export function useFirstRunWelcome() {
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: api.bootstrap });
  const userId = boot.data?.profile?.userId;
  const joinedCount = boot.data?.joined.length;

  useEffect(() => {
    if (!userId || joinedCount !== 0) return;
    let cancelled = false;
    readSecret(key(userId)).then((done) => {
      if (!cancelled && !done) router.push("/welcome");
    });
    return () => {
      cancelled = true;
    };
  }, [userId, joinedCount]);
}
