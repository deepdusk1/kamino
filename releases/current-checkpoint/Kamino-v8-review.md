# Kamino v8 review

Reviewed October 3, 2026. Verdict: **a substantial functional prototype with a convincing visual identity, but not ready for a public launch.** Fix administrator identity and age access first, then complete a focused device and service beta. More features should not be the next priority.

## Scope and evidence

I extracted the attached 16.3 MB Kamino-v8.zip from the referenced chat. The Linux `/mnt/data` address was not present in this Windows session; the chat attachment supplied the same named ZIP locally. I inspected the web/server and native app sources, migrations, deployment scripts, store materials, tests and design components. I installed the locked dependencies in an extracted review copy, built the website, exported both native JavaScript bundles, ran tests, and inspected fresh browser renders.

The referenced chat supplies the ten-screen inventory, the blank-picture instruction, and the full Horizon feature map. It does **not** supply the original mockup images themselves. Visual assessment therefore uses the actual rendered app and ZIP's store screenshots; exact pixel fidelity to the original mockups cannot be certified.

Fresh render coverage includes welcome, login, onboarding, Home, Explore, community, Create, chats, notifications, profile, settings, post detail and a conversation. I checked a 390-pixel phone viewport, 320-pixel Explore, dark mode, and desktop Home at 1440 pixels. Production renders used the locally served built output. This is not a real iPhone/Android hardware test or a test of a deployed PostgreSQL installation.

| Check | Result from this review |
|---|---|
| Web dependency installation | Passed |
| Web TypeScript | Passed |
| Web unit suite | 187 passed |
| Web lint | 0 errors, 13 warnings |
| Production web build | Passed; database migration command skipped external PostgreSQL because no DATABASE_URL was supplied |
| Mobile TypeScript and lint | Passed |
| Mobile unit suite | 77 passed |
| Web/mobile contract | 113 calls matched |
| Core integration suite | 27 groups passed against development server |
| Mobile API integration | 25 groups passed against built server with bulk-test rate limits disabled |
| Social integration | 25 checks passed against built server with expected test administrator configured and bulk-test limits disabled |
| iOS and Android JavaScript exports | Passed with two build workers; native store binaries were not built |
| Built-output browser checks | Nine targeted captures completed with no recorded page/console errors |
| Dependency audit | Web: 1 high finding. Mobile: 31 affected package entries, 20 high and 11 moderate |

The initial mobile integration run hit the enabled posting limiter; rerunning on the isolated bulk-test server passed. The core suite discovers generated functions from development source, so it cannot run unchanged against production output; it passed on the appropriate development server. An initial browser pass suffered local resource shortages and a failed profile load during concurrent native export. The focused built-output pass subsequently rendered profile and other screens cleanly. These were verification setup limitations, not counted as demonstrated product failures.

## What is strong

**This is much more than a collection of mock screens.** Database-backed community membership, permissions, posting, comments, polls, quizzes, drafts, following, notifications, messaging, reports, moderation and account deletion have actual server implementations. The integration tests exercise meaningful boundaries, including private posts, revoking access after leaving, media authorization, moderation roles and deletion.

**The design has a recognizable identity.** The planet logo, violet/blue gradients, near-white backgrounds, rounded cards, Plus Jakarta Sans headings and five-item navigation recur across the main screens. Post detail is especially clear: content, reactions, comments and the reply field have a sensible hierarchy. Chats and the new-user profile also render coherently.

**The implementation is organized around shared components.** Both clients have reusable card, avatar, button, chip, header and layout components, with centralized theme tokens. Native API calls reuse the web server's business functions rather than maintaining a second permission implementation.

**Safety and privacy received real implementation effort.** There are message requests, block/mute controls, quiet hours, reports, appeals, moderation queues, audit logging, data export/import, private accounts, age confirmation and in-app deletion. Server queries generally use parameterized SQL. Upload limits, protected media access and a structured object-storage implementation are present.

**The archive includes useful delivery groundwork.** Twenty-five numbered migrations, launch scripts, a deployment blueprint, backup/restore scripts, a store kit, and tests make this easier to maintain than a screenshot-only prototype. The README candidly identifies several untested external services and real-device scenarios.

## Fix first: launch blockers

### P0 — Administrator access can be claimed using an unverified email

`web/src/lib/kamino/safety.server.ts:63` grants administrator status by comparing the account's email to KAMINO_ADMIN_EMAILS. It does not check emailVerified. The email/password configuration in `web/src/lib/auth/server.ts:217` does not require email verification.

**Reproduced:** I registered a disposable account using the administrator email configured on the isolated built server. The account's emailVerified value was false, but adminSetVerified succeeded and gave the account a verified badge.

**Impact:** an attacker who registers an allowlisted address before its legitimate owner can receive site-owner privileges. This does not demonstrate taking over an already registered administrator account. Nevertheless, administrator authority must not depend on an unproven address.

**Fix:** provision administrator roles against stable user IDs through a controlled setup process. Require verified email before granting any email-based privileged role. Reserve privileged identities during deployment and require stronger authentication for administrator accounts. Test that a newly registered, unverified allowlisted address cannot verify users, review private safety cases or perform any site-owner action.

### P0 — Age restrictions are bypassable and do not protect reading

`web/src/lib/kamino/server.ts:2673` accepts ageConfirmed from Settings, and line 2757 writes it into the profile. `joinCommunity` at line 1250 trusts that flag. Public community reading through canRead at line 160 and READABLE_COMMUNITY in `social.ts:276` does not enforce age eligibility.

**Reproduced:** a test account with a January 2012 birthday passed the 13+ check, set ageConfirmed=true, then successfully joined a 16+ community. A separate request with no login could read a benign test post inside that 16+ community.

**Fix:** remove age eligibility from user-editable settings. Keep a server-controlled age band or eligibility policy and apply it to discovery, feeds, community/post pages, search, media, chats, events and joining. Decide how people become eligible as they get older without casually allowing an override. Test anonymous visitors, under-16 users, eligible users, links opened directly and media endpoints. Community creation currently clamps the age gate to 13 or 16; the broader 18+ claims do not represent a distinct implemented creation option.

## P1 — Resolve before a wider beta

### Content can become readable before moderation completes

The createPost path inserts its readable database row before awaiting reviewContent (`server.ts:1543–1565`). Messaging follows the same insert-then-review pattern. Another read during that interval can see content that will later be held, particularly while an external moderation call is slow. This is a code-path finding; I did not run a deliberately delayed moderation-service race test.

Insert new content in a pending state excluded by every read path, then publish or hold it after review. Apply the same rule to edits. Define what happens when moderation times out, especially for pictures, and make review failures visible to operators. The current moderation client returns no AI verdict on service errors; built-in text rules remain, but that is not equivalent to image screening.

### Narrow the RPC surface and validate inputs at runtime

`web/src/routes/api/v1/rpc/$name.ts:72` routes both GET and POST into the same handler, which invokes any registered server function. I successfully changed a profile headline using GET with a bearer token. The cross-site metadata test was rejected with 403, so this review does **not** claim a demonstrated browser CSRF exploit.

Keep writes POST-only and use an explicit operation registry with method metadata. Replace pass-through TypeScript validators with runtime schemas where appropriate. Reject oversized request bodies before reading them fully and return sanitized unexpected errors rather than arbitrary internal error messages. Add negative tests for wrong methods, malformed field types and oversized media envelopes.

### Fix small-screen clipping and legibility

At 320 pixels, Explore's hero headline consumes the fixed-height card and clips the description; the four-column recommended grid also clips Join controls and faces. Even at 390 pixels, names and descriptions are frequently abbreviated. The native community card uses title sizes around 11–11.5 and description size 10 (`mobile/src/components/k/CommunityCard.tsx:55`), with small Join labels.

Use two columns on narrow phones, or fewer wider cards in a horizontal row. Allow two lines for names, make important text larger, and let hero height grow with text. Test system text scaling, translations, screen readers and touch targeting. Hit slop exists on native buttons, which helps, but crowded controls and nested clickable cards still need device testing. Bright native Join colors with small white labels also deserve a measured contrast pass.

### Finish release configuration and real service verification

The native production API address in eas.json is still a placeholder; EAS_PROJECT_ID is empty; support falls back to support@your-domain.example. The blueprint uses free hosting/database plans and lacks a configured media bucket, mail and call relay by default. The store kit and deployment instructions are groundwork, not evidence that these are provisioned.

Configure a real server URL, identity/origin settings, support address, push credentials, outgoing mail, storage, TURN and administrator provisioning. Verify email/password recovery, push delivery, deep links, two-device calls, media upload/deletion and backup restoration against the actual providers. Produce internal native builds and test on both physical platforms, including microphone/camera permissions, background/resume, poor networks and expired sessions.

### Review dependency advisories and release bundles

The audit found one high web dependency finding and 31 affected mobile package entries. These are not 31 independent exploitable flaws: many are propagation through Expo/Metro tooling. Determine the affected execution paths and upgrade within a compatible Expo/React Native set. Do not blindly accept suggested force fixes, some of which propose major downgrades.

The production web build also warns about Node modules being externalized for browser compatibility, and its public assets contain roughly 10 MB of PGlite WASM and 6.3 MB of database data. This does not prove those files are all downloaded on ordinary page load. Inspect the actual network waterfall and isolate server-only database/auth imports so browser payloads contain only what the client requires.

## P2 — Improve the everyday experience and maintainability

**Move the feed nearer the top of Home.** On a normal phone the first screen is mostly promotion, category chips, recommended/trending communities and streak/event cards. Featured creators follow before posts. Collapse or rotate secondary sections; prioritize joined-community activity and conversations for returning users. Explore can carry most discovery promotion.

**Reduce repeated decoration and truncation.** The brand is attractive, but gradients, badges, tiny portraits, counters and emojis compete in compact cards. Keep decoration strongest on major calls to action. Use one clear primary action per card and provide full titles where users choose content. The Create screen truncates “Community”; the community ranking card truncates its value.

**Split Settings into clear tasks.** The web settings page is very long and mixes editing a profile, cosmetics, interests, privacy, notifications and account management. Separate Edit profile, Appearance, Privacy/Safety, Notifications and Account/Data. Make save status obvious for each task rather than relying on a distant shared save button.

**Make reminders reliable when the app is closed.** ensureEventReminders (`server.ts:470`) runs when someone opens the app; it is not a scheduled worker. Replace this with a durable job for reminders at a defined time. Add push ticket/receipt handling, retries and delivery diagnostics. Scheduled posts becoming visible by timestamp works, but scheduled mentions/notifications also need an explicit delivery policy.

**Plan capacity from measured use.** Chat polls messages about every 2.5 seconds on web and 4 seconds on native, with separate typing and receipt polling. Whole room histories can be repeatedly returned. For a small beta this is workable; measure bandwidth and query costs, use incremental synchronization and move to a suitable realtime channel when needed. The limiter is process-local, so multiple server instances will not share budgets.

**Reduce backend coupling.** The core server file has 4,766 lines and social.ts has 1,992. Split operations by domain behind stable contracts, introduce transaction boundaries for multi-step writes, and add focused concurrency tests for toggles, counters and membership changes. Public reads are not covered by the signed-in overall limiter. Feed ranking sorts a bounded 400-post window with offsets, which can skip/repeat posts as ranking changes; use a stable cursor/snapshot strategy if this becomes visible in normal use.

**Harden external fetching.** The RSS reader validates resolved IPs and then fetches the hostname separately, allowing a DNS validation/fetch mismatch in principle. Pin the validated destination or enforce outbound network restrictions and revalidate the actual connection. This is a static concern, not a reproduced exploit.

**Test the empty production experience.** Production sample content is off, which is correct. The demo screenshots have many communities and creators; a new real installation starts empty. Recruit a few launch communities, appoint their moderators and test onboarding with zero results, one community, no creators and no events. Do not let showcase demo identities or stale store images stand in for real activity.

## Current screens and feature coverage

| Area | Present in v8 | Qualification |
|---|---|---|
| Welcome, interests and onboarding | Welcome slides, age check, interests, suggested communities/creators, profile setup | Real flows; test cold start and empty recommendations |
| Account | Email/password, reset routes, profile and deletion | Email ownership verification is the critical gap; no turnkey Apple/phone login demonstrated |
| Home and discovery | Ranked feed, Following/Communities tabs, recommendations, categories, trending/new/growing, universal search and filters | Ranking is a heuristic; this is not natural-language AI discovery |
| Community | Public/private/unlisted, membership, rules, topics, roles, cover/theme editor, wiki, files, news, ranks, events, moderation | Strong breadth; age access is incomplete |
| Content | Blogs/images/questions/links/polls/quizzes/wiki/stories, albums, comments, saving, reposting, drafts and scheduling | Not a full video/audio/short-form publishing platform |
| Chat and calls | DMs/community rooms, media, voice notes, reactions, editing, requests, typing/read receipts, WebRTC calls | Code and API checks present; real-device calling remains unverified here |
| Events and stories | Events/challenges/RSVP, expiring multi-scene stories, role-play stories | Recurrence/calendar integration and the richer story feature map are not complete |
| Profile/social | Photos/covers, pronouns/location/link, categories, badges, follow lists, mutual follows, private follow requests, block/mute | Native/web screenshots follow the same general identity |
| Engagement | Check-ins, streaks, reputation, leaderboards, 75 achievements, cosmetics | Plenty for an initial beta |
| Notifications | Categories, actions, mentions, preferences and quiet hours, push plumbing | Requires actual push verification and background reminder jobs |
| Safety | Reports, holds, appeals, bans/mutes, owner safety queue, AI assistance | Human operations and secure administrator identity must be in place |

## Consistency with the Horizon/Kamino conversation

All ten named core mockup areas have corresponding implementations. Navigation follows Home · Communities · Create · Chats · Profile; Explore is the Communities destination. The visual language is consistent across the fresh web renders and supplied store material, and native shared components use equivalent tokens.

The archive contains illustrated covers, profile imagery and avatar substitutes rather than blank picture areas. This differs from the earlier mockup request. That instruction concerned mockup deliverables; real app photos are reasonable functionality. If the intended design-review version must preserve blank slots, provide a review-only placeholder mode. Do not remove production media features solely to mimic a wireframe.

The full 25-area Horizon list was a long-term vision, and the prior conversation explicitly recommended a smaller launch scope. v8 extends well beyond that initial scope, but is not the full vision. Features absent or not evidenced as finished include creator/community growth and retention analytics, subscriptions/payments, native Apple/phone authentication, two-factor and session/device management, natural-language AI discovery/translation/summaries, recommendation feedback/reset, rich video/audio publishing, story video/music/highlights, recurring/calendar-linked events, full stage-room speaker/listener tools and replays, custom-role administration, and a broad operator/customer-support back office. Some basic metrics and safety administration exist; those are not comprehensive analytics or back-office tools.

Most of these are **later roadmap items**, not reasons to postpone a secure basic community launch. Advanced monetization and AI should wait. The older web-only coin wallet is an inconsistency to resolve or intentionally document; the README itself contains contradictory old and updated coin rules.

## Concrete next steps

1. **Security repair:** replace email-only admin grants; make age eligibility server controlled and enforce it on every read; add regression tests for the reproduced cases; hold content pending review; make mutation RPCs POST-only.
2. **Responsive and accessibility pass:** repair the 320-pixel layouts, enlarge cards/text, eliminate clipped action labels, simplify Home and Settings; verify large text, keyboard, screen reader, contrast and dark mode.
3. **Release engineering:** fix compatible dependency advisories, inspect web bundle/network behavior, configure production identities/URLs/services, run migrations on actual PostgreSQL, and prove database plus media recovery.
4. **Real-device beta:** install internal iOS and Android builds; test sign-up to first community/post/comment/DM, permissions, notification taps, recovery, calls across Wi-Fi/mobile networks, reconnects and deletion. Verify external provider behavior rather than relying on mocks.
5. **Small staffed community pilot:** seed real communities, choose moderators, handle reports/appeals, observe onboarding and first-week retention. Expand only after the critical flows and operations are reliable.

**Release gate:** no public launch while unverified identities can obtain administrator authority or minors/anonymous users can bypass age restrictions. After those repairs, device/provider verification and a staffed closed beta are more valuable than adding another feature category.

Fresh screenshots are available in the accompanying [screen gallery](Kamino-screen-gallery.html). Files in this review are observations and review deliverables; I have not changed the application's product source or deployed it.
