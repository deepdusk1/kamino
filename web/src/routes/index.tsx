import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Flame,
  Plus,
  Sparkles,
  Search,
  BookOpen,
  MessageCircle,
  PenLine,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PostCard } from "@/components/post-card";
import { Composer } from "@/components/composer";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { homeFeed, toggleLike, toggleFavorite, checkIn } from "@/lib/kamino/server";
import { toast } from "sonner";
export const Route = createFileRoute("/")({ loader: () => homeFeed(), component: Home });
function Home() {
  const initial = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const feed = useQuery({ queryKey: ["home"], queryFn: () => homeFeed(), initialData: initial });
  const [tab, setTab] = useState("For you");
  const [term, setTerm] = useState("");
  const [compose, setCompose] = useState(false);
  const [slug, setSlug] = useState("");
  const data = feed.data;
  const posts = (
    tab === "Following"
      ? data.latest
      : tab === "Latest"
        ? Array.from(new Map([...data.latest, ...data.featured].map((p) => [p.id, p])).values())
        : data.featured
  ).filter((p) => !term || (p.title + " " + p.body).toLowerCase().includes(term.toLowerCase()));
  async function like(id: number) {
    if (!user) {
      toast.error("Sign in to like a post.");
      return;
    }
    try {
      await toggleLike({ data: id });
      await feed.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <AppShell title="Your daily orbit">
      <div className="home-layout">
        <div className="home-main">
          <div className="section-heading">
            <div>
              <p className="eyebrow">GOOD TO SEE YOU HERE</p>
              <h1>
                Your people. <span>Your universe.</span>
              </h1>
            </div>
            <span className="pill">
              <Sparkles size={14} /> Made for belonging
            </span>
          </div>
          <section className="orbit-banner">
            <img
              src="/covers/orbit-vivid.png"
              alt="Colorful illustrated worlds linked by music, stories, art and conversation"
            />
            <div>
              <span className="eyebrow">A LITTLE LESS SCROLLING. A LOT MORE CONNECTION.</span>
              <h2>
                Find the corner
                <br />
                that feels like you.
              </h2>
              <Link to="/explore" className="solid-button">
                Explore communities <ArrowUpRight size={17} />
              </Link>
            </div>
          </section>
          <div className="section-heading small">
            <h2>{data.joined?.length ? "Your communities" : "Find your next obsession"}</h2>
            <Link to="/explore">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="community-strip">
            {(data.joined.length ? data.joined : data.communities).slice(0, 6).map((c) => (
              <Link key={c.id} to="/c/$slug" params={{ slug: c.id }}>
                <img src={c.cover} alt="" />
                <strong>{c.name}</strong>
                <span>{c.category}</span>
              </Link>
            ))}
          </div>
          <div className="compose-bar">
            <div className="compose-avatar">
              <PenLine size={20} />
            </div>
            <button
              onClick={() => {
                if (!user) {
                  toast.error("Sign in to create a post.");
                  return;
                }
                if (!data.joined.length) {
                  toast.error("Join a community to start posting.");
                  return;
                }
                setSlug(data.joined[0].id);
                setCompose(true);
              }}
            >
              What’s happening in your world?
            </button>
            <Plus size={20} />
          </div>
          <div className="feed-toolbar">
            <div role="tablist" aria-label="Feed">
              {["For you", "Following", "Latest"].map((t) => (
                <button
                  role="tab"
                  aria-selected={tab === t}
                  key={t}
                  onClick={() => setTab(t)}
                  className={tab === t ? "active" : ""}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="feed-search">
              <Search size={16} />
              <input
                aria-label="Search posts"
                placeholder="Find a post…"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </label>
          </div>
          <div className="post-grid">
            {posts?.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                communityName={data.communities.find((c) => c.id === p.communityId)?.name}
                onLike={like}
                onSave={async (id) => {
                  try {
                    await toggleFavorite({ data: id });
                    void feed.refetch();
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            ))}
          </div>
          {!posts?.length && (
            <div className="empty-state">
              <BookOpen />
              <h3>
                {tab === "Following" ? "Your feed starts with your communities" : "No posts found"}
              </h3>
              <p>
                {tab === "Following"
                  ? "Join a community and follow people you enjoy."
                  : "Try a different search or share the first post."}
              </p>
              <Link to="/explore">Explore communities →</Link>
            </div>
          )}
        </div>
        <aside className="home-rail">
          <section className="rail-card checkin-card">
            <span className="round-icon">
              <Flame />
            </span>
            <p className="eyebrow">MAKE IT A DAILY THING</p>
            <h2>
              A little hello
              <br />
              goes a long way.
            </h2>
            <p>Check in, build your streak, and grow with your communities.</p>
            <button
              className="solid-button"
              onClick={async () => {
                try {
                  const r = await checkIn();
                  toast.success(
                    r.already
                      ? `Already checked in · ${r.streak} day streak`
                      : `Checked in! ${r.streak} day streak · +5 coins`,
                  );
                } catch {
                  toast.error("Sign in to check in.");
                }
              }}
            >
              Daily check-in <Plus size={16} />
            </button>
          </section>
          <section className="rail-card">
            <div className="section-heading small">
              <h2>Go a little deeper</h2>
              <Sparkles size={17} />
            </div>
            {[
              {
                to: "/explore",
                icon: CalendarDays,
                title: "Find your community",
                copy: "A home for every interest",
              },
              {
                to: "/chats",
                icon: MessageCircle,
                title: "Find a conversation",
                copy: "Chat, roleplay & hang out",
              },
              {
                to: "/saved",
                icon: BookOpen,
                title: "Your little collection",
                copy: "Bookmarks worth keeping",
              },
            ].map((x) => (
              <Link key={x.to} to={x.to as "/"} className="rail-link">
                <x.icon size={21} />
                <div>
                  <strong>{x.title}</strong>
                  <span>{x.copy}</span>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </section>
          <section className="rail-card community-spotlight">
            <img src="/covers/atelier.jpg" alt="Art community" />
            <p className="eyebrow">COMMUNITY SPOTLIGHT</p>
            <h2>
              Make something.
              <br />
              Share the process.
            </h2>
            <Link to="/c/$slug" params={{ slug: "atelier" }}>
              Step into the Atelier <ArrowUpRight size={15} />
            </Link>
          </section>
          <p className="rail-footer">
            A space for every side of you.
            <br />
            <Link to="/settings">Privacy & safety</Link> · Kamino
          </p>
        </aside>
      </div>
      {compose && (
        <Composer
          slug={slug}
          onClose={() => setCompose(false)}
          onCreated={() => {
            setCompose(false);
            void feed.refetch();
            toast.success("Your post is live.");
          }}
        />
      )}
    </AppShell>
  );
}
