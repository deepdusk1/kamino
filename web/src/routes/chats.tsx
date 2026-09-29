import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/chats")({ component: ChatsLayout });

function ChatsLayout() {
  return <Outlet />;
}
