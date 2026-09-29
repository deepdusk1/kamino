# Amino × Kamino — feature review (corrected, release 6)

Reviewed September 29, 2026 against the code in this package, not against an older build.

**How to read this.** Amino is compared from its well-known features and the entry screens captured earlier; signed-in Amino communities were not inspected, so this is not a claim of full parity. Each row says what Kamino has **in this package**, and every "Built" row is covered by an automatic test named in the last section.

Status words: **Built** (works, tested here) · **Built differently** (same purpose, different design on purpose) · **Excluded** (against Kamino's house rules) · **Yours to provide** (needs accounts, staff or hardware that code cannot supply).

House rules: no ads, no coins or in-app currency, no paywalled stickers, no notification spam, ages 13+, low maintenance, humans decide moderation.

## Corrections to the earlier review

The earlier review was written from a web-only build. These claims are now wrong or out of date:

| Earlier claim | Now |
| --- | --- |
| No native iOS / Android apps | Both exist (`mobile/`, Expo). They still need a first test on a real phone. |
| Only a weekly leaderboard | Activity, check-in streak and quiz boards over week, month and all time, per community. |
| Check-in is global only | Each community has its own daily check-in with a streak and a little reputation. |
| Challenges are just events | Challenges take entries (your own posts), leaders judge once (1st/2nd/3rd), reputation is awarded once, winners are notified. |
| One sticker set | Three free packs, 36 stickers, on web and phone. |
| Frames only "ring, moon, star, laurel" | Also sparkles, flame, crown and aurora; plus four chat bubble styles. All free. |
| Single-picture image posts | Albums: cover plus up to five pictures. |
| Drafts need a button press | Drafts also save themselves a few seconds after you stop typing (web and phone). |
| Shared folder is one flat list | Nested folders, moving items, and leader-set level locks that hide the link from lower levels. |
| Export only, no import | Import returns your posts and drafts as private drafts (never auto-published, safe to repeat). |
| No age check beyond a tick box | Sign-up asks a birthday once, stores only "13 or older", erases younger accounts. Teenagers cannot unlock 16+/18+ halls. |
| No abuse protection | Per-person limits on posting, commenting, messaging, reports, community creation, follows, invites and uploads (HTTP 429 with a friendly message). |
| No backup story | `npm run backup` and `npm run restore` (consistent snapshot, verified row counts, tested on real PostgreSQL). |
| Calls fail on strict networks | TURN relay settings are supported (`KAMINO_TURN_*`); you provision the relay. |

## Capability comparison

| Area | Capability | Kamino |
| --- | --- | --- |
| Communities | Public and private communities, categories, rules | Built |
| | Join questions, approval, invite codes | Built |
| | Leader / curator / member roles, titles | Built |
| | Community discovery and search (communities, posts, #hashtags, people) | Built |
| | Per-community nickname and persona bio | Built |
| | Custom look per community (name, colour, five colour styles, cover, icon) | Built, leaders only, web and phone; buttons stay readable whatever colour is chosen. Not a free-form CSS editor, on purpose. |
| Creation | Blog, image, question, link, poll, quiz, wiki, story | Built |
| | Multi-picture posts (albums) | Built |
| | Quizzes (many questions, scored, once-only rewards) | Built, with a picture per question and an optional time limit measured by the server |
| | Stories that expire after 24 hours | Built, up to six scenes with captions |
| | Drafts, autosave, save a copy | Built |
| | Content warnings, comments off, announcements | Built |
| Wiki | Approved library, categories, review queue, edit history, restore | Built |
| | Proposals from other members with credit | Built |
| | Pin wiki entries to a profile | Built |
| Chat | Public, private and direct chats, replies, reactions | Built |
| | Photos, voice notes, video | Built |
| | Stickers | Built (3 free packs; nothing to buy) |
| | Pinned and muted conversations, search, older-message paging | Built |
| | Voice rooms with live audio/video/screen share (website) | Built; **not verified on two real devices here** |
| | Live calls in the phone app | Built (audio, optional video, mute, ringing, shared with the website's calls); **needs a development/store build, not Expo Go, and has not been tried between two real devices** |
| Profiles | Photo, bio, mood, status, cover, wall | Built |
| | Avatar frames and chat bubble styles | Built, all free |
| | Characters / personas, achievements, titles | Built |
| | Follow, block, report | Built |
| Engagement | Daily check-in and streaks (global and per community) | Built |
| | Leaderboards | Built |
| | Events, RSVPs, challenges with judging | Built |
| | Notifications and push (you choose which) | Built; push delivery needs a first real-phone test |
| Economy | Coins, coin purchases, tipping | **Excluded** by house rules (an older Coins wallet remains on the website only; see below) |
| | Rewarded ads / offer walls | **Excluded** |
| | Paid fan clubs / VIP tiers | **Excluded** |
| | Amino+ style subscription, paid cosmetics or stickers | **Excluded** |
| Moderation | Reports, hide/remove, strikes, timed mutes, bans | Built |
| | Appeals (bans and mutes), audit log | Built |
| | Join screening, broadcasts | Built |
| | Someone actually watching your community | **Yours to provide** |
| Accounts | Email sign-up, password reset, sign-in on web and phone | Built; email delivery needs your Resend key |
| | Phone-number or social sign-in | Not built (configuration only, needs provider accounts) |
| | 13+ birthday gate | Built |
| | Export and import of your data | Built |
| | Delete my account in the app | Built |
| Delivery | Website, iOS app, Android app | Built |
| | One-command publisher for the stores (`Publish-Kamino.cmd`) | Built; needs your Expo, Apple and Google accounts |
| | Hosting, database, backups | Render blueprint included; **you provision it** |
| | Media on object storage (S3/R2) | Built (optional); tested against a signature-checking pretend bucket, **not a real provider**; bucket needs its own backup |

## What "better than Amino" still requires from you

1. **A real-device test.** Open the built apps on an iPhone and an Android phone, and try a call between two devices and between a phone and the website. Nobody has done this yet.
2. **Accounts and money for hosting and stores** (Render, Expo, Apple US$99/year, Google US$25 once).
3. **People.** Appoint leaders and curators. Kamino gives them every tool but does not replace them.
4. **A lawyer's look** at the Privacy Policy and Terms, which are drafts, not legal advice.
5. **A decision on the old website Coins wallet.** It predates the "no coins" rule, is not in the phone app, and contradicts the house rule. Removing it is a small job once you decide.

## Not done in this release

A phone-number or social sign-in (needs provider accounts), a speaker/earpiece switch for phone calls (needs one more native library), and the removal of the old website Coins wallet (waiting for your decision). Everything else from the earlier "not done" list is now built.

## What was verified

- 128 website and 45 phone unit tests; TypeScript and lint with no errors on web and phone; production web build; iOS and Android JavaScript bundles; Android native-project generation with the calling plugin.
- Integration suites against a running server: 27 core groups, 15 writing groups, 10 chat-media groups, 2 wallet groups, 24 phone-API groups (also against real PostgreSQL, where all 22 migrations applied), 9 object-storage groups against a pretend bucket that checks every request signature, 3 rate-limit groups on a server with limits on.
- A check that the phone app's expectations match what the server sends (54 calls).
- The phone call engine: 11 tests with pretend connections; the server side of calls in the phone-API suite.

Not verified here: audio or video between physical devices (including phone to browser), a real S3/R2/B2 bucket, real email and push delivery, how the screens feel on a real iPhone or Android phone, store submission, payments, and staffed moderation.
