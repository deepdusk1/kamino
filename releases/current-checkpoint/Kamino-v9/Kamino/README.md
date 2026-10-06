# Kamino

Kamino is a calm community app and a replacement for Amino. It ships as a **website plus
native iPhone and Android apps**, all from this one folder.

House rules: **the core app stays free**, reputation and moderation cannot be bought, members control notifications, ages 13+, and humans review held content. Release 9 adds optional offers and a Stripe sandbox. Payments are disabled by default; real-money purchases, creator payouts and native store billing remain unavailable.

## Release 9: community, creator and safety expansion

This release adds shared web/native tools for richer posts and stories, reply threads, group chats and files, community boards/FAQs/roles/policies, events, live stages, quests and earned cosmetics. It also adds privacy/security screens, real authenticator login, configurable provider sign-in, a tutorial, native contact matching, discovery tools, creator analytics, collaboration briefs, support and verified administration.

Paid offers have test checkout, a signed-webhook ledger, subscriptions, gifts, tickets and server-enforced access to mapped communities/posts/rooms/events. Active premium test access raises Content Studio/file attachment quotas and enables GIF avatars. Live billing is deliberately rejected. Read `web/BILLING.md` before configuring a sandbox, and `web/IDENTITY_SECURITY.md` before configuring authentication.

The website can be installed from a supporting desktop/mobile browser. Its offline screen keeps private member data out of the cache. This is an installable web app; no separate Windows/macOS executable is included.

The remaining feature and launch limits are recorded in `RELEASE-9.md`. This release does **not** represent all 490 checklist items as complete.

## What's new in release 8: the redesign

The phone app and the website were rebuilt to match the 10 design mockups (Welcome, Pick Your Interests,
Home, Explore, Community, Post, Create, Chats & Live Rooms, Notifications, Profile), with a new look
(Plus Jakarta Sans, white cards, violet-to-blue gradients, the planet logo) on both.

New features that came with it:
- **Onboarding:** Welcome slides, then pick your interests, join suggested communities, follow creators and set up your profile.
- **Home:** recommended and trending communities, daily streak, the next live event, featured creators, and a feed with For You / Following / Communities tabs.
- **Explore and search:** one search for people, communities, posts, tags, rooms and events, with filters and recent searches.
- **Profiles:** verified and creator badges, headline, pronouns, location, website, profile categories, showcase banners, badges, friends (people you both follow), private accounts with follow requests, mute.
- **Chats:** live rooms with participant counts, message requests from strangers, typing indicators and "Seen" receipts.
- **Create:** one place for posts (up to 10 pictures, polls, location, link, tags, members-only, scheduled posts), stories, live rooms and events.
- **Notifications:** All / Social / Community / Events filters with Follow Back and Join buttons, quiet hours and per-category switches.
- **Moderation:** comments can be deleted by their author or community moderators; site owners can mark people as verified or creators.

## What is inside

| Path | What it is |
| --- | --- |
| `Start-Kamino.cmd` / `start.sh` | **One click to try everything on your own computer** (Windows / Mac / Linux). |
| `web/` | The Kamino server **and** website (TanStack Start; PGlite locally, PostgreSQL in production). |
| `mobile/` | The native **iOS + Android** app (Expo / React Native). Talks to `web/`. |
| `render.yaml` | One-click hosting recipe for [Render](https://render.com) (server + database). |
| `DEPLOY.md` | **Step-by-step guide: put it on the internet and publish the apps.** Start here when you are ready. |
| `store/` | App Store and Google Play kit: listing text, privacy answers, reviewer notes, screenshots, banner. |

## 1. Try it now (10 minutes, nothing to configure)

1. Install [Node.js 24](https://nodejs.org) (the "LTS" or newest installer is fine).
2. To test the native app, use an iOS/Android development or store build and connect the phone to the **same Wi-Fi** as your computer. Calls and the new native plugins require a compiled app; Expo Go is insufficient.
3. Start Kamino:
   - **Windows:** double-click `Start-Kamino.cmd`
   - **Mac / Linux:** open a terminal in this folder and run `./start.sh`
4. The first start installs everything by itself (a few minutes). Then it prints a **QR code**:
   open it with your installed Kamino development client. The website is at http://localhost:8080.

Press `Ctrl+C` in that window to stop everything. To run only the website: `node start.mjs --server`.

## 2. What the app can do

**Look and feel:** a softly moving colour "aurora" behind every screen, iOS-style frosted glass
(Apple's real Liquid Glass on iOS 26+), a floating glass tab bar, springy buttons with haptics, a heart
burst when you like something, cards that float in, animated polls and streaks, light and dark mode.
Animations switch off when the phone's Reduce Motion setting is on.

**Features:**
Sign-up and password reset, home feed, discover and global search (communities, posts, #hashtags,
people), communities (public and private, join questions, rules), eight post types (blog, image,
question, link, poll, quiz, wiki, story), comments, likes, saving, drafts, shared wiki library,
chat rooms and direct messages (photos, voice notes, video, replies, reactions), events and
challenges with judging, leaderboards (activity, check-in streaks, quizzes), daily check-in in each community, free sticker packs, free avatar frames and chat bubble styles, image albums, quizzes with a picture per question and an optional time limit, stories with several scenes, a per-community look editor (colour, style, cover, icon), live calls in the phone app, **AI safety checks that hold illegal or dangerous posts, chats and pictures for a human moderator**, **role-play stories where members play characters from books and films and an AI storyteller narrates and writes new endings**, your own profile wall cover, **75 achievements with banners and progress bars**, draft autosave, shared-file folders, members, shared files, news feeds, profiles with **profile photos**,
wall and achievements, follow / block / report, notifications and push, a first-run welcome that
helps new people find communities, full moderation tools (reports, join requests, strikes, timed
mutes, bans, appeals, broadcast, invite codes), data export and import, a 13+ birthday check, and in-app account deletion.

## 3. Going public

Follow **`DEPLOY.md`**. In short: put this folder on GitHub, click "New Blueprint" on Render, run
`npm run set-server https://your-address` in `mobile/`, then build the apps with Expo (EAS) and
submit them using the texts in `store/STORE-LISTING.md`.

Set `KAMINO_SAMPLE_CONTENT=off` (already done in `render.yaml`) so a real server starts empty
instead of with the built-in sample communities and made-up members.

## 4. Health checks

```sh
cd web    && npm run typecheck && npm test && npm run check:contract
          # with the dev server running: npm run test:mobile && npm run test:integration && npm run test:creator && npm run test:chat-media
          # npm run test:limits needs a dev server started WITHOUT KAMINO_RATE_LIMIT=off
cd mobile && npm run typecheck && npm run lint && npm test && npm run export:check
```

## 5. Honest limits

- The app has not yet been opened on a physical iPhone or Android phone by whoever built it; every
  screen was exercised in a phone-sized browser against the real server, and the iOS and Android
  bundles compile. Expect to polish a few small layout details after your first real-device test.
- Push notifications are wired end to end but need one test on a real phone after your first EAS build.
- Live calls (audio, optional video) now exist in the phone app and share the website's call service, but **nobody has yet heard a call between two real devices**. They need a development or store build (the calling library is native code, so **not Expo Go**; everything else still works in Expo Go). On ordinary networks they should connect directly; behind strict office or mobile networks they need a TURN relay (`KAMINO_TURN_URLS`, see `web/.env.example`), which you provision.
- Photos, videos and voice notes are stored in the database unless you set the `KAMINO_S3_*` variables (see `web/.env.example`) to use an S3-compatible bucket such as Cloudflare R2. That was tested against a pretend bucket that checks request signatures and against AWS's published signing examples, **not against a real provider**. With a bucket, keep it private and turn on the bucket's own versioning/backup: `npm run backup` saves the database only, not the bucket's files.
- Backups are a command you run (`npm run backup` in `web`), not something Kamino schedules for you: use your host's paid-database backups too.
- Moderation is by people. Kamino gives leaders every tool, but nobody is watching your community unless you appoint them.
- The website still has an older Coins wallet (tipping). It is not in the phone app and it goes against the "no coins" rule above; ask for it to be removed if you agree.
- The AI is free but basic. It will sometimes pause a harmless post or miss a bad one, which is why a person always makes the final decision. It needs two free keys (see `DEPLOY.md`, step 4b); it was tested against a pretend AI service here, not against OpenAI or Groq themselves, and their free limits can change.
- Role-play with characters from films and books is fan fiction. The storyteller is told to write original words and never copy lines or lyrics, but fan fiction of commercial characters still carries some legal risk if Kamino grows; ask a lawyer before promoting it.
- The Privacy Policy and Terms are sensible drafts, **not legal advice**. Have them reviewed. The privacy page now explains the AI services (content is sent to OpenAI and Groq for checking and storytelling); make sure your lawyer sees that part too.
- Free hosting plans sleep or expire (details in `DEPLOY.md`). Use paid plans for real users.
