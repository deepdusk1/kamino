import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Coins, Flame, Gift } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ScreenTitle } from "@/components/k";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { checkIn, getWallet } from "@/lib/kamino/server";
import { toast } from "sonner";

export const Route = createFileRoute("/wallet")({ component: Wallet });

function Wallet() {
  const { user, isPending } = useCurrentUserState();
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => getWallet(), enabled: !!user });
  if (!isPending && !user) return <RedirectToSignIn />;
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-3 px-4 lg:space-y-4 lg:px-0 lg:pt-2">
        <ScreenTitle title="Coins" subtitle="A little thank-you for showing up." />
        <section className="relative overflow-hidden rounded-card bg-grad-top-creator p-6 text-white shadow-card sm:p-8">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-lg">
              <Coins className="size-4" /> COMMUNITY COINS
            </span>
            <p className="mt-4 text-5xl font-extrabold tracking-[-0.03em] sm:text-6xl">
              {wallet.data?.balance ?? "…"}
              <span className="ml-2 text-2xl" aria-hidden>
                ✦
              </span>
              <span className="sr-only"> coins</span>
            </p>
            <p className="mt-2 max-w-md text-sm text-white/90">
              A little thank-you for showing up. Earn coins by checking in and give them to creators
              and friends you appreciate.
            </p>
            <button
              type="button"
              className="k-focus mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-[#5b20b9] shadow-lift transition-transform hover:-translate-y-0.5"
              onClick={async () => {
                try {
                  const result = await checkIn();
                  await wallet.refetch();
                  toast.success(
                    result.already
                      ? "You've checked in today already."
                      : "+5 coins · thanks for being here!",
                  );
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not check in.");
                }
              }}
            >
              <Flame className="size-5" /> Daily check-in
            </button>
          </div>
          <div className="pointer-events-none absolute -top-6 -right-4 text-[140px] leading-none text-white/15 select-none" aria-hidden="true">
            ✦
          </div>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="k-card rounded-card p-4">
            <Flame className="size-6 text-pink" />
            <h2 className="mt-2 text-[16px] font-extrabold text-ink">Earn a little each day</h2>
            <p className="mt-1 text-sm text-muted">
              Your first check-in each UTC day awards 5 coins and keeps your streak going.
            </p>
          </div>
          <div className="k-card rounded-card p-4">
            <Gift className="size-6 text-violet" />
            <h2 className="mt-2 text-[16px] font-extrabold text-ink">Share the appreciation</h2>
            <p className="mt-1 text-sm text-muted">
              Visit a member’s profile to send a tip of 1–100 coins.
            </p>
          </div>
        </div>
        <section className="k-card rounded-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-extrabold text-ink">Recent activity</h2>
            <Link to="/explore" className="k-focus text-[13px] font-bold text-violet">
              Find people →
            </Link>
          </div>
          {wallet.isLoading && <p className="mt-5 text-sm text-muted">Opening your wallet…</p>}
          {wallet.error && (
            <p className="mt-5 text-sm text-danger">Could not load your coins. Try again.</p>
          )}
          {wallet.data?.history.length === 0 && (
            <p className="mt-5 text-sm text-muted">Your coin story starts with a daily check-in.</p>
          )}
          <div className="mt-3 divide-y divide-border">
            {wallet.data?.history.map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-tint-violet text-violet-ink">
                  {item.direction === "in" ? (
                    <ArrowDownLeft className="size-5" />
                  ) : (
                    <ArrowUpRight className="size-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {item.kind === "checkin"
                      ? "Daily check-in"
                      : item.direction === "in"
                        ? `Tip from ${item.otherName ?? "a member"}`
                        : `Tip to ${item.otherName ?? "a member"}`}
                  </p>
                  <p className="text-xs text-muted">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <strong className={item.direction === "in" ? "text-green-ink" : "text-pink-ink"}>
                  {item.direction === "in" ? "+" : "−"}
                  {item.amount}
                </strong>
              </div>
            ))}
          </div>
        </section>
        <p className="px-2 text-center text-xs font-medium text-muted">
          Coins are for fun inside Kamino. They cannot be bought, sold, or exchanged for money.
        </p>
      </div>
    </AppShell>
  );
}
