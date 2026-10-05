# Completion work checkpoint

The validated release is v9, under `releases/local-v9/` in the GitHub checkpoint. Its feature status and verification remain the baseline. Source changes after that release are work in progress and have not yet passed the integrated build gates. This checkpoint preserves current work; it does not declare all 490 features complete.

## Active implementation

- Media: `media-v10*` modules, migration `0039_media_v10.sql`, persistent story layers, a real uploaded GIF/media library, short-video feed, and article image blocks. Native screen integration is ongoing.
- Social/events: `social-events-v10*` modules and migration `0040_social_events_v10.sql`, friend-request consent, group invites/roles, timezone-aware event series, event discussion and attendance passes. Native UI fixes and existing group permission integration remain ongoing.
- Operations: `operations-v10*` modules and migration `0041_operations_v10.sql`, durable notification delivery, email digests, moderation cases/appeals, experiments and seasons. Registry, navigation and privacy integration remain ongoing.
- Search: `search-v10*` modules and migration `0042_semantic_search.sql`, real configured embedding index, semantic results, opt-in personalized recommendations and duplicate detection. Screens, registry, privacy integration and tests remain ongoing.

## Required integration and verification

Register new server functions in `web/src/lib/kamino/mobile-api.ts` and the contract checker. Register native screens inside the signed-in route guard. Update data export, account deletion and durable media cleanup for every new personal-data table. Preserve current server age/block/private/paid access enforcement. Apply every migration filename. Run web/native type checks, lint, meaningful unit and HTTP integration checks, production compilation, native exports and rendered-screen verification before changing the validation claims.

Payments remain disabled. External provider accounts, licensed catalogs, signing/store accounts, production deployment and physical-device tests remain external requirements. Never insert fake provider results, credentials or a completion percentage to close these requirements.

## Completed on top of the v10 integration (October 5, 2026)

All gates re-run green after these changes: web/native TypeScript, web production build, 290 web
unit/integration checks, 87 native checks, the phone contract (214 typed responses, 323 RPC names
across 13 mobile modules), and clean ESLint runs on both apps.

- Watch party: Vimeo and Twitch sources with the same P2P sync as YouTube/files (`shelf.ts`,
  `live-stage.tsx`), a shared queue with voting and host-only play (`watch.ts`, migration
  `0043_watch_party.sql`), and ready checks. The phone app opens the watch deck in-app
  (`chat/watch/[roomId].tsx`, needs a fresh development build for react-native-webview).
- Referral program: personal invite codes, sign-up attribution on web, +150/+50 reputation
  rewards (`referrals.ts`, `referrals.server.ts`, migration `0044_referrals.sql`, unit tests).
- The v10 orphaned operations are wired: an originality (duplicate-post) check in the web Content
  Studio composer and a "reindex semantic search" action in admin operations on web and native.
- Data export now covers the watch-party tables (`privacy-v9.server.ts`); deletion was already
  complete through cascades.
- Signed-out visitors get a marketing landing page on `/`; the guided tour remains at `/welcome`.
- Offline detection: NetInfo drives TanStack Query's online manager plus an offline banner
  (`connectivity.tsx`, needs a fresh development build for @react-native-community/netinfo).
- Legacy Coins wallet removed from the website; copyright/takedown policy page and report reason
  added; the storyteller token-budget regression test now passes with real constants.

Still requiring operator decisions or external accounts (unchanged): production payments and
payouts, native store purchases, real age verification, an SFU for large stages/recordings,
interface translation catalogs (i18n/RTL), licensed music catalogs, physical-device and store
testing, and paid hosting with backups.

## Interface translation started (October 5, 2026)

- Web: `src/lib/i18n/` — typed catalogs (English source of truth, Spanish first), `useT()`,
  locale metadata for every recognised profile language, per-key English fallback, and a cookie
  (`kamino.locale`) read by the root loader so the server renders the right language. Tests guard
  catalog drift and placeholder parity (6 checks).
- Covered surfaces in Spanish: the marketing landing (with a footer language switcher), the whole
  sign-in/create-account page, navigation labels (bottom bar and header), home feed tabs and empty
  states, and the privacy-dashboard language section.
- The privacy-dashboard picker (web) now writes the cookie and reloads, so a language change
  applies immediately; the phone app's picker updates labels live through the query cache.
- Mobile: `src/lib/i18n.ts` with the same catalog shape, sourced from the member's saved
  language; Spanish covers the five tab labels and the language section.
- RTL: locale metadata carries an `rtl` flag and the root sets `<html dir>` from it, but direction
  only switches when the locale has a real catalog, so no locale shows English text in a broken
  RTL layout. A visual RTL audit remains future work alongside the next catalog (Arabic).

## The "needs external accounts" list is now built (October 5, 2026)

Everything that was previously deferred for lack of provider keys now ships as complete,
dormant-safe code — every feature refuses cleanly (or hides) until its environment variables are
set, so nothing changes without explicit operator configuration. All gates re-run green:
web/native TypeScript, web production build, unit/integration suites (including 8 new server
tests), the phone contract, and clean ESLint on both apps.

- **Live billing + creator payouts**: `KAMINO_BILLING_MODE=live` (plus a live key) switches the
  existing checkout to real money; completed orders credit a creator earnings ledger with a
  configurable platform fee (`KAMINO_PLATFORM_FEE_PERCENT`), and creators connect Stripe Express
  and request payouts from the new Creator money page. `BILLING.md` documents the switch and the
  operator duties it implies.
- **Independent age verification**: Stripe Identity document check behind
  `KAMINO_AGE_VERIFICATION_ENABLED` + billing keys; `identity.verification_session.*` webhooks
  stamp `profiles.age_verified_at`. The document never reaches Kamino.
- **LiveKit SFU (large stages, enforced publish rights, recordings)**: with
  `KAMINO_LIVEKIT_URL/API_KEY/API_SECRET`, the web stage mints role-scoped join tokens (only
  hosts/co-hosts/speakers can publish — enforced by the token grant, not client convention) and
  carries media through the SFU while watch-party sync stays on P2P data channels. Hosts can
  record rooms via room-composite egress into the media bucket (`room_recordings`,
  start/stop/list ops). Without the variables the peer-to-peer mesh is unchanged. The native app
  continues on the P2P path until a dev build ships with the LiveKit native SDK.
- **Auto-captions (transcription)**: any Whisper-compatible endpoint
  (`KAMINO_TRANSCRIBE_URL/KEY/MODEL`) transcribes uploaded video/audio in the background and
  stores WebVTT captions on the media row.
- **Transcoding**: with `KAMINO_TRANSCODE_ENABLED=true` (and ffmpeg on the host), uploads are
  re-encoded to 720p H.264 in the background and the stored reference is swapped.
  Both media pipelines are tested with injected network/exec doubles.
- **GIF search**: Tenor (`KAMINO_TENOR_KEY`) or Giphy (`KAMINO_GIPHY_KEY`) search in the Content
  Studio on web and native; imports go through the server's storage path with size/mime checks.
- **Offline message queue (native)**: chat messages that fail to send while offline are queued
  with a client tag and replayed automatically on reconnect; the server de-duplicates on the tag
  (`messages.client_tag`), so retries can never double-post.
- **Tablet layout (native)**: at ≥768pt width the bottom bar becomes a left navigation rail.

Still intentionally not built: licensed music catalogs (licensing deals), a professional
accessibility audit (human work), native in-app store purchases (requires store enrollment and
native billing libraries), and the desktop app (excluded by decision; the website is installable
as a PWA). Push/email/AI providers keep working the moment their keys are set.
