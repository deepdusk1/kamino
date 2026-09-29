# Kamino update — verification notes

Base: the newer `tqGkLPgNgn4QudrX-grok-workspace.zip` supplied by the user. The older ZIP was not used to replace the new feature set.

## Changes

- New vector K logo, matching favicon and app manifest.
- Redesigned home and sign-in screens, richer discovery header, bright pastel palette, frosted-glass surfaces, soft animated light effects, reduced-motion support, and responsive layouts.
- Scrollable keyboard-accessible post dialog. Image/story posts accept a real image instead of silently using the same placeholder. The optional second quiz question has its own answer selection.
- Persistent local database and signing secret; Windows launch fixes; production runtime includes the database engine's WASM/data assets.
- Email sign-in works without shared preview OAuth credentials. Provider buttons remain hidden until configured. Local HTTP and public HTTPS use suitable cookie settings.
- Chat membership is rechecked after leaving or being banned. Blocked direct conversations are denied. Voice signaling verifies the session, room access, peer identity, recipient access, and origin.
- Latest chat messages remain visible beyond 200 messages. Empty messages and cross-room replies are rejected. Failed sends retain the draft and show an error; repeated send clicks are prevented.
- Poll options and quiz definitions are validated. Correct quiz answers are withheld from readers. Quiz reputation is awarded once. Daily check-in uses an atomic UTC date check.
- Likes and bookmarks retain their state on the home feed and profiles. Action buttons display failures and avoid duplicate clicks.
- Private, hidden, expired, blocked, and banned-community content is filtered in the corrected feed, profile, saved-post and post-access paths. Private posts cannot be reposted into another community.
- Repeated approvals/bans no longer inflate or decrement membership counts repeatedly; inactive moderators and edits to community leaders are rejected in the corrected moderation paths. Invitation codes use cryptographic randomness.
- Account-private saved drafts with optimistic revision checks, save-copy and resume. Quiz creators can add up to 30 independent questions, pick the correct answer for each and reorder them. The editor has limited formatting and a safe preview. Drafts are saved when requested; automatic background saving is not provided.
- Wiki pages have a searchable approved library, an all-pages view, an author view, a leader/curator review queue, rejection feedback and resubmission. Edited approved pages return to review. Hidden and blocked pages no longer appear in the wiki list.
- Approved wiki pages can be copied to personal drafts with a source link and pinned to profiles. Wiki authors can inspect earlier versions and restore one; restorations return approved pages to review.
- Chat adds photo attachments, browser-recorded voice notes, reactions, pinned/muted conversations, unread badges, older-message paging and in-room search. Membership checks protect each media fetch and search.
- Community leaders can show, hide, and reorder navigation tabs. Duplicate module settings and non-leader changes are denied. The setting affects navigation rather than page permissions.
- Authored-content export now includes full own posts/comments, drafts, characters, own messages and attachments, wiki revisions/pins, wall posts and shared resources. Dates render consistently across the server and browser. Joining or leaving refreshes community screens. Former members cannot edit their old posts.

## Passed checks

- TypeScript compilation without errors.
- Lint completed with zero errors; 15 existing warnings remain in legacy helpers, live-stage hooks and build configuration.
- 73 automated tests covering authentication/session helpers and existing app-data behaviour.
- 27 integration groups against real local HTTP endpoints: public feed; private-read authentication; registration; joining; quiz scoring/reward limits; invalid quizzes; polls; likes/bookmarks; comments; daily check-in; settings; community/chat creation and editing; voice-signaling access; events/RSVPs; outsider privacy; repeated approvals; leave/access revocation; repeated bans; characters; community titles; walls; following; shared resources; broadcasts/questions/invites; watch media; images/editing/comment controls/private repost restrictions; account export. Some groups contain several assertions.
- 15 creator integration groups: private drafts, sign-in/size validation, conflicting edits, cross-account privacy, leader navigation controls, multi-question quiz scoring, wiki submission/review permissions, rejection/resubmission, profile pinning, template copy/source credit, edit history/restore, re-review after editing, hidden/blocked wiki filtering, authored export, draft deletion and revoked editing after leaving.
- 9 chat-media integration groups: photo/voice persistence, type/size validation, outsider protection, reactions, pin/mute preferences, older-message paging, in-room search and former-member denial, deletion, and access revocation.
- Production build completed. Its built home and login pages returned HTTP 200 after including the database assets.
- Browser checks: create account, sign out, sign back in, join a community, compose and publish a post, filter the home feed, like/save a post, open saved content and profile, open a chat, and send a message.
- Browser restart checks confirmed the test account, joined community, and published post persisted.
- Current browser checks: a new account joined a community; a two-question quiz draft was saved, closed, reopened with both answer selections intact, previewed with formatting, then published to a real post page. Wiki category/search and its empty state were inspected. The screenshot files in the download folder show the actual creator, published post and wiki screens.
- Latest browser checks: colorful home and chat at desktop/mobile widths; chat pin and reaction controls changed and persisted; an approved wiki was pinned from its page and appeared on the member profile. Server-backed tests verified copy, revisions and restoration. Microphone capture itself was not exercised in-browser.
- Visual review at desktop size (1440 × 1000) and phone size (390 × 844). The phone home and chat screens had no horizontal overflow; loaded home images had no broken sources.

## Verification limits

This is a tested source update and local preview, not a public deployment or a guarantee that every possible interaction is bug-free. The original generator's platform fixture suite is retained as `test:legacy-scaffold`; it is separate from the 73-test application run and is not claimed as passing in this standalone environment. Chat media is stored in the local database with size caps; public-scale hosting needs a managed media service and operational limits.

Voice/video signaling and stored watch-party settings were tested; two physical devices exchanging live microphone/camera media, screen sharing, restrictive networks/TURN, and mobile operating-system permissions still need testing. OAuth provider credentials, production PostgreSQL hosting, email delivery/recovery, push delivery, store payments, and native app-store packaging were not provisioned or validated here.

The app includes sample content from the ZIP. Local QA accounts and database files are excluded from the downloadable source. The expanded JSON export covers the user's authored content and own chat attachments, but it is not a complete account archive: all account events, every message from other participants and an import path are outside its scope. External media URLs remain links.

The historical Amino comparison is in `Amino-vs-Kamino.md` beside the app ZIP. An original signed 2022 APK launched in a separate emulator; accessible login, signup, age-entry and recovery screens were captured. Signed-in Amino communities were not inspected, so the report distinguishes direct observation from shipped UI strings and archived help pages. It does not claim full parity or a verified official shutdown date.

## Mobile release update (iOS + Android)

Added in this update: the Expo app in `../mobile`, a JSON bridge for it (`/api/v1/rpc/<name>`, bearer-token sign-in), Expo push delivery, chat media streaming with byte ranges, video attachments, timed mutes, member appeals, wiki categories with nested paths and edit proposals with contributor credit, RSS news feeds (https, public addresses only), password reset by email, in-app account deletion, and public privacy / terms / delete-account pages.

Checks run for this update: TypeScript clean on both projects; 77 backend unit tests; 27 + 15 + 10 + 2 + 9 integration groups (the 9 are new: `npm run test:mobile`, covering the bridge, bearer auth, media range requests, mutes, appeals, wiki proposals, feed SSRF refusal and account deletion); mobile lint clean, 11 mobile unit tests; iOS and Android production bundles compile (`npm run export:check`); all 23 mobile screens were opened in a 390 × 844 browser against the live server with no request or script errors, and composer (poll publish, draft save), chat send, moderation tools and wiki drill-down were exercised end to end.

Not verified: installation on a physical iPhone/Android device or simulator, push delivery to a real device, live voice/video calls in the phone app (not implemented), store-review outcome, and legal review of the privacy policy and terms (drafts, not legal advice).

### Release-readiness update (photos, search, onboarding, launcher, store kit)

Added: profile photos (`profile_avatars` table, migration 0016, cache-busting `avatar_version`), global search (`searchAll`: communities, posts, #hashtags, people, with privacy filters), a first-run welcome screen, `KAMINO_SAMPLE_CONTENT=off` for a clean public server, automatic migrations on `npm start`, a one-click launcher (`Start-Kamino.cmd` / `start.sh`), `npm run set-server` for the phone app, a Render blueprint (`render.yaml`), a hosting guide (`DEPLOY.md`) and a store kit (`store/`).

Fixed while producing store screenshots: the like button on a post page showed a stale count until tapped (state was only read on first render).

Checks: the mobile integration suite now has 11 groups (adds profile photos and search) and passed against the dev server; the production build was also run against a real PostgreSQL server (migrations, build and the mobile suite). All screens were screenshot at iPhone (430 × 932) and Android (360 × 800) widths against a clean demo server with no page or request errors. Not done here: opening the app on a physical phone or simulator, delivering a push notification, live voice/video.

### Design update (vibrant glass UI)

The phone app got a new look: animated aurora backgrounds, frosted glass (Liquid Glass on iOS 26+ via `expo-glass-effect`, `expo-blur` elsewhere, tinted glass on Android), a floating glass tab bar, spring/haptic presses, entrance animations and a like burst (`react-native-reanimated` 4.5.1 / `react-native-worklets` 0.10.1, the versions Expo SDK 57 and Expo Go ship). All native packages match SDK 57's expected versions, so the app still runs in Expo Go.

Found and fixed during the full visual pass: the Me tab's "My communities" read fields the server does not send (no names, broken links); "Unblock" in Settings used the wrong field names; the weekly leaderboard was sorted by likes but showed a different score. A new `npm run check:contract` type-checks all 40 typed phone calls against the server's real return types, and the mobile integration suite gained a group for leaderboard order and the `getMe` shape (12 groups).

Checks for this update: web and mobile TypeScript and ESLint (0 errors), 77 backend and 11 mobile unit tests, contract check, all integration suites (12 + 27 + 15 + 10 + 2), production build and mobile suite on PostgreSQL, iOS and Android bundles compile, every screen screenshot in light and dark at phone size with no script errors. Not done here: running on a physical phone or simulator (so Liquid Glass, Android blur fallback and haptics were not seen on a device).

## Release 5 update (all remaining reviewable gaps)

Added: per-community daily check-in with streaks; leaderboards (activity / check-in streak / quizzes over week, month and all time); challenges with entries and one-time leader judging (1st/2nd/3rd, reputation, notifications); three free sticker packs (36 stickers, never paid); free avatar frames (sparkles, flame, crown, aurora) and chat bubble styles (soft, glass, outline, bold) on web and phone; image albums (cover plus five pictures, served as real image files with the post's access rules); draft autosave on web and phone; shared-file folders (nested paths, leader-set level locks that hide the link from lower levels, moving items); import of an exported data file (posts and drafts return as private drafts, never published, safe to repeat); export format version 4 includes album pictures.

Reliability and safety: per-person rate limits (overall 600 calls/min, tighter on posting, comments, messages, reports, community creation, follows, invites, uploads) answering HTTP 429 with a friendly message; 13+ birthday gate on web and phone (checked once, never stored; under-13 accounts erased; teenagers can not unlock 16+/18+ halls); TURN relay settings for calls; consistent database backups and verified restore (`npm run backup`, `npm run restore`); a check that the phone app's expectations match what the server sends (`npm run check:contract`).

Passed here: 111 unit tests; 27 + 15 + 10 + 2 integration groups; 21 phone-API groups (also against real PostgreSQL, where all 20 migrations applied); 3 rate-limit groups on a server with limits on; TypeScript and lint (0 errors) on web and phone; production web build; phone JavaScript bundle export.

Still not verifiable in this environment: two physical devices exchanging live audio/video/screen share, real email or push delivery, feel of the phone UI on a real iPhone or Android phone, store accounts and payments, staffed moderation, legal review of Privacy and Terms, and object storage for media (media is stored in the database).

Left out on purpose (Kamino house rules): rewarded ads, buying coins, fan clubs sold for coins, a paid Amino+ style subscription, paid cosmetics or sticker stores.

Known leftover: the website still contains an older Coins wallet and tipping feature (migration 0014). It is not in the phone app and it conflicts with the "no coins" house rule; removing it is a decision for the owner.

## Release 6 update (the five items left over from release 5)

Added: **object storage** (S3, R2, MinIO and similar; hand-written request signing checked against two published AWS test vectors; files for posts, chat, avatars, covers and quiz pictures; deleted with their post, message or account; included in the data export), a **community look editor** (name, tagline, description, rules, colour, five colour styles, cover from the built-in list or uploaded, icon; the accent colour is always dark enough to read white button text; leaders only; on web and phone), **quiz pictures and timed quizzes** (a picture per question; one time limit for the whole quiz; the clock runs on the server from the moment Start is pressed, so a player cannot claim a faster or longer time; answers that arrive long after the limit score 0; pictures are hidden until the quiz is started), **multi-scene stories** (up to six scenes with a short caption each, stepped through one by one; still gone after 24 hours) and **live calls in the phone app** (audio, optional video, mute, ringing and an incoming-call banner; the phone joins the same call service as the website).

Passed here: 128 web and 45 phone unit tests; 27 + 15 + 10 + 2 integration groups plus 24 phone-API groups (also on real PostgreSQL with all 22 migrations); 9 object-storage groups against a pretend bucket that checks every request signature; 3 rate-limit groups; the contract check (54 phone calls); web and phone TypeScript and lint with 0 errors; production web build; iOS and Android bundles; an Android native-project generation that includes the calling plugin. The call engine is covered by 11 tests that use pretend connections (who dials whom, two people offering at once, early network candidates, hanging up, being refused), and the server side of calls (sign-in token on the call service, only room members, one delivery per offer, ringing, hang-up) by a phone-API group.

Not verifiable here, and the honest reason for each:
- **Calls between real devices.** No physical phone or second browser with a microphone was available. The engine follows the website's proven negotiation and passed its tests, but audio quality, echo, Bluetooth headsets and the speaker/earpiece choice have never been heard. Calls need a development or store build (the calling library is native code), not Expo Go; in Expo Go the app works and the call screen explains this.
- **A real bucket.** Tested against a pretend bucket and AWS's published signature examples, not against Amazon, Cloudflare or Backblaze themselves.
- **How the new screens feel on a phone** (theme editor, quiz timer, story viewer, call screen).
- Email and push delivery, store accounts and staffed moderation, as before.

Found and fixed on the way: the website's route generator overwrote an edited layout file with an empty template when the file was saved while the dev server was running (an editing hazard of the dev server only; production builds are unaffected).

Known leftover: the older website Coins wallet (migration 0014) still conflicts with the "no coins" house rule; removal is the owner's decision.
