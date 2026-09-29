import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Bookmark,
  Coins,
  Compass,
  House,
  MessageCircle,
  Search,
  Shield,
  User,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { bootstrap } from "@/lib/kamino/server";
import { cn } from "@/lib/utils";
import { KMark } from "./k-mark";
import { IncomingCall } from "./incoming-call";
import { AgeGate } from "./age-gate";

const NAV = [
  { to: "/", label: "Home", icon: House },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/notifications", label: "Activity", icon: Bell },
  { to: "/me", label: "Me", icon: User },
] as const;

export function AppShell({
  children,
  title,
  actions,
  hideNav = false,
}: {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
  hideNav?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const [unread, setUnread] = useState(0);
  const [needsAge, setNeedsAge] = useState(false);

  useEffect(() => {
    if (!user) return;
    void bootstrap()
      .then((b) => {
        setUnread(b.unread);
        setNeedsAge(b.profile ? !b.profile.minAgeConfirmed : false);
      })
      .catch(() => undefined);
  }, [user]);

  return (
    <div className="kamino-shell min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-border bg-bg px-4 py-5 md:flex">
        <Link to="/" className="mb-8 flex items-center gap-2.5 px-2 text-fg">
          <KMark className="size-8 text-accent" />
          <span className="font-display text-xl font-extrabold tracking-tight">Kamino</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-full px-3 text-sm font-bold transition-colors duration-150",
                  active ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface hover:text-fg",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={1.8} />
                  {item.to === "/notifications" && unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent-fg" />
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/wallet"
            className={cn(
              "mt-2 flex h-11 items-center gap-3 rounded-full px-3 text-sm font-bold text-muted hover:bg-surface hover:text-fg",
              pathname.startsWith("/wallet") && "bg-elevated text-fg",
            )}
          >
            <Coins className="size-5" strokeWidth={1.8} />
            Coins
          </Link>
          <Link
            to="/saved"
            className={cn(
              "mt-2 flex h-11 items-center gap-3 rounded-full px-3 text-sm font-bold text-muted hover:bg-surface hover:text-fg",
              pathname.startsWith("/saved") && "bg-elevated text-fg",
            )}
          >
            <Bookmark className="size-5" strokeWidth={1.8} />
            Saved
          </Link>
          <Link
            to="/settings"
            className={cn(
              "mt-2 flex h-11 items-center gap-3 rounded-full px-3 text-sm font-bold text-muted hover:bg-surface hover:text-fg",
              pathname.startsWith("/settings") && "bg-elevated text-fg",
            )}
          >
            <Shield className="size-5" strokeWidth={1.8} />
            Safety
          </Link>
        </nav>
        <div className="mt-auto border-t border-border pt-4">
          {isPending ? (
            <div className="h-10 w-full animate-pulse rounded-full bg-elevated" />
          ) : user ? (
            <UserButton />
          ) : (
            <Link
              to="/login"
              className="flex h-11 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg"
            >
              Sign in
            </Link>
          )}
        </div>
      </aside>

      <div className={cn("md:pl-60", hideNav ? "" : "pb-20 md:pb-0")}>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 bg-bg/90 px-4 backdrop-blur-sm">
          <Link to="/" className="flex items-center gap-2 text-accent md:hidden">
            <KMark className="size-7" />
          </Link>
          <p className="min-w-0 flex-1 truncate font-display text-lg font-extrabold tracking-tight">
            {title ?? "Kamino"}
          </p>
          {actions}
          <Link
            to="/explore"
            className="grid size-11 place-items-center rounded-full text-fg hover:bg-elevated"
            aria-label="Search"
          >
            <Search className="size-5" strokeWidth={1.8} />
          </Link>
        </header>
        <div className={cn("mx-auto w-full", pathname === "/" ? "max-w-[1440px]" : "max-w-4xl")}>
          {children}
        </div>
      </div>

      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
          <ul className="grid grid-cols-5">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold",
                      active ? "text-accent" : "text-muted",
                    )}
                  >
                    <span className="relative">
                      <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                      {item.to === "/notifications" && unread > 0 && (
                        <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-accent" />
                      )}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      {user ? <IncomingCall /> : null}
      {user && needsAge ? <AgeGate onDone={() => setNeedsAge(false)} /> : null}
    </div>
  );
}
