# Kamino release 9

This source release expands the supplied v8 app on web, iPhone and Android. It is a candidate for local use and controlled testing. It does **not** declare all 490 checklist items finished or the app ready for public launch.

Read `FEATURE-STATUS.md` for the category-by-category checklist audit and remaining work. `web/BILLING.md` documents the payment sandbox; `web/IDENTITY_SECURITY.md` documents sign-in and safety configuration. Old release entries in the READMEs and `web/QA-NOTES.md` describe historical checks, not the current release.

## Added in this release

- Richer posts, GIF/video/audio/file uploads, long articles, author alt text/captions, reply threads, best answers, reactions, history, personal hide/mute/follow and analytics.
- Text/video/audio stories, simple stickers and polls/questions, highlights and portfolios; shared community access rules still apply.
- User-created group chats, owner/member controls, protected files, message pins and in-chat share cards. Assignable group moderators/co-admins are not included.
- Community boards/FAQs, functional roles, invite-only/direct invitations, ban/unban, configurable policies, keyword filters, appeals, audit and analytics.
- Expanded events, calendar export, repeats, event conversations, stage roles/hand raising, room locks and earned quests/cosmetics.
- Chosen usernames, links/interests/profile accents, muted/restricted/close-friend/favorite lists, privacy controls, account security/devices, TOTP/backup codes, tutorial and explicit native contact matching.
- Configurable real Google/Apple/phone sign-in, email confirmation and CAPTCHA. External services remain inactive until configured and tested.
- Discovery/feed feedback, local-area matching, editorial collections, contextual suggestions, interest matching/graph and copyable introductions. Configurable AI helpers use an actual provider; formula-based feed ranking remains separate.
- Creator engagement/unique-view dashboards, adult collaboration briefs/proposals, support, verified administration, safety/report review and aggregate growth/retention.
- Recognized discovery feature switches with stable account rollout cohorts. Full experiment exposure/conversion analysis is not included.
- Background notification jobs and an installable web app with a generic offline page that excludes private member data from caching.

Standalone profile stories are published without choosing a community on both apps, with real media, questions/polls, highlights, close-friend/follower audiences and shared server privacy/age/expiry checks. Story reports and automatic text flags reach site reviewers; hide/restore decisions are audited. Uploaded music is a file, not a licensed catalog. Audio/video itself is not automatically transcribed or safety-scanned.

## Payments stay disabled

Offers, access requirements, purchase history and a signed-webhook test ledger are included. The default configuration makes no checkout or provider request. An explicitly configured Stripe **test account** can exercise subscriptions, tips, gifts, tickets and mapped digital access. Active test premium grants GIF avatars and higher supported upload quotas.

Live Stripe keys/events are rejected. Native store purchases, creator payouts, production marketplace operations and automatic boost/advertisement delivery remain unfinished. These are development limits, not features silently enabled by configuration. Follow `web/BILLING.md` before opening a sandbox to testers.

## Run and upgrade

Use the included one-click launcher for local work, or install with the checked-in locks in `web` and `mobile`. Start the native app with a fresh development client; Expo Go cannot run every included native module. See [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

For an existing installation, take a verified backup before deploying. Apply **every migration filename**, including duplicate numeric prefixes. Release 9 adds migrations `0026` onward; `0037_profile_stories.sql` adds independent stories and `0038_media_deletion.sql` adds durable external-object cleanup. `0035_activity_analytics.sql` records distinct authenticated UTC activity and removes records when an account is deleted. Historical activity is not invented or backfilled. Retention windows must mature before useful cohorts are available.

Production needs persistent PostgreSQL, canonical HTTPS, a new authentication secret, verified email delivery and verified administrator identities. Keep sample content off. Set a strong `KAMINO_JOB_SECRET`; the long-running Node start process launches a minute worker. Serverless hosting requires an external authenticated scheduler instead. Configure private storage, backups and TURN as appropriate.

Known flag consumers are `discovery_assistant` and `related_discovery`; absent flags preserve existing behavior. Disabled/cohort-excluded assistant requests are refused on the server. Custom flag keys are stored but do not automatically change unrelated screens. Payment activation cannot be delegated to these flags.

Account deletion commits database changes atomically and transfers shared group ownership. External file cleanup is staged durably and attempted after commit; the job worker retries failures. Other members’ content and already-paid gifts keep their existing access/expiry. Provider subscription cancellation still requires an operator; see `web/BILLING.md`.

## Validation

The delivered verification summary is in `FEATURE-STATUS.md`. Automated checks cover TypeScript, lint, shared web/native response contracts, unit tests, real local HTTP fixtures, web production compilation and native iOS/Android JavaScript exports. The screen gallery contains captures of the rendered website, including small-phone, desktop, dark and offline states.

An exported native bundle is not a signed installable app. This session did not verify physical-device permissions, two-phone calling, real push/email delivery, external provider sign-in, a real Stripe test-account transaction, store submission, production PostgreSQL deployment or production load. Generated fixture data and local credentials are excluded from this package; repeatable test scripts are included.

## Before public launch

1. Configure and verify production identity, persistence, scheduler and recovery; test all authorization boundaries on the public hostname.
2. Triage the native dependency audit and verify compatible upstream fixes. The observed web audit is clear; the native Expo/Metro tree still reports high/moderate advisories.
3. Test signed native builds on real iPhone and Android devices, including calls, denied/limited permissions, contacts, provider callbacks, TOTP, media, notification delivery and offline recovery.
4. Test backups/restores, object storage, migrations and representative load. Larger live stages need stronger media infrastructure; recording is not implemented.
5. Complete production billing/store commerce before collecting money. Complete the remaining checklist items, translations and accessibility review in `FEATURE-STATUS.md`.
6. Refresh store assets/disclosures, remove sample accounts/content, staff moderation/support and conduct a controlled beta.
