/**
 * The server writes notification links in website form ("/c/starlight/p/12").
 * This turns them into screens of the phone app. Unknown links open the notification list.
 */
export function appHrefFromServerHref(href: string): string {
  const post = /^\/c\/([^/]+)\/p\/(\d+)$/.exec(href);
  if (post) return `/community/${post[1]}/post/${post[2]}`;
  const story = /^\/c\/([^/]+)\/roleplay\/(\d+)$/.exec(href);
  if (story) return `/community/${story[1]}/roleplay/${story[2]}`;
  const mod = /^\/c\/([^/]+)\/mod$/.exec(href);
  if (mod) return `/community/${mod[1]}/mod`;
  const community = /^\/c\/([^/?#]+)/.exec(href);
  if (community) return `/community/${community[1]}`;
  const call = /^\/chats\/(\d+)\?call=1$/.exec(href);
  if (call) return `/call/${call[1]}`;
  const chat = /^\/chats\/(\d+)$/.exec(href);
  if (chat) return `/chat/${chat[1]}`;
  const profile = /^\/u\/([^/?#]+)/.exec(href);
  if (profile) return `/profile/${profile[1]}`;
  return "/notifications";
}
