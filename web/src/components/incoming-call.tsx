import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Phone, PhoneOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Face } from "@/components/face";
import { dismissNotification, listIncomingCalls } from "@/lib/kamino/server";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { hashHue } from "@/lib/utils";

export const KAMINO_CALL_EVENT = "kamino-call";

export function parseCallHref(href: string): number | null {
  const m = href.match(/\/chats\/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function dispatchAnswerCall(roomId: number) {
  try {
    sessionStorage.setItem("kamino-call", String(roomId));
  } catch {
    /* */
  }
  window.dispatchEvent(new CustomEvent(KAMINO_CALL_EVENT, { detail: roomId }));
}

export function IncomingCall() {
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState<number | null>(null);
  const q = useQuery({
    queryKey: ["incoming-calls"],
    queryFn: () => listIncomingCalls(),
    enabled: !!user,
    refetchInterval: 2000,
  });
  const incoming = useMemo(() => {
    const rows = q.data ?? [];
    return rows.find((c) => c.id !== hidden) ?? null;
  }, [q.data, hidden]);

  useEffect(() => {
    if (!incoming) return;
    const prev = document.title;
    document.title = `${incoming.name} is calling`;
    return () => {
      document.title = prev;
    };
  }, [incoming]);

  if (!incoming) return null;
  const roomId = parseCallHref(incoming.href);
  if (!roomId) return null;
  if (typeof document === "undefined") return null;
  const hue = hashHue(incoming.name);

  function decline() {
    setHidden(incoming!.id);
    void dismissNotification({ data: incoming!.id }).catch(() => undefined);
  }

  function answer() {
    setHidden(incoming!.id);
    void dismissNotification({ data: incoming!.id }).catch(() => undefined);
    dispatchAnswerCall(roomId!);
    void navigate({ to: "/chats/$roomId", params: { roomId: String(roomId) } });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-bg px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-16"
      role="dialog"
      aria-label="Incoming call"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <span className="k-ring relative grid place-items-center">
          <Face name={incoming.name} hue={hue} size="call" />
        </span>
        <div className="text-center">
          <p className="font-display text-3xl font-extrabold tracking-tight">{incoming.name}</p>
          <p className="mt-1 text-sm font-bold text-ok">Incoming call</p>
        </div>
      </div>
      <div className="flex w-full max-w-xs items-center justify-around pb-4">
        <button
          type="button"
          onClick={decline}
          className="grid size-16 place-items-center rounded-full bg-danger text-fg"
          aria-label="Decline"
        >
          <PhoneOff className="size-7" />
        </button>
        <button
          type="button"
          onClick={answer}
          className="grid size-16 place-items-center rounded-full bg-ok text-bg"
          aria-label="Answer"
        >
          <Phone className="size-7" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
