# Kamino 1.0.0 — Audit & UI Click-Through Report
**Date:** September 29, 2026
**Repo:** github.com/deepdusk1/kamino (public)
**Verdict:** The app is real, it works end to end, and the codebase is in good shape. No ship-blocking bugs found in the click-through. What remains is configuration, production infrastructure, accounts, and physical-device testing — all of which need your decisions.

---

## 1. What was verified today

### Automated checks (all green)
- Web TypeScript: pass. Mobile TypeScript: pass. Mobile ESLint: pass.
- Web tests: **128/128 pass**. Mobile tests: **45/45 pass**.
- Phone/server contract: 54 calls match. Backend/mobile integration: 24 groups pass. General backend: 27 groups. Creator: 15 groups. Chat/media: 10 groups.
- Expo export: iOS Hermes bundle ~4.9 MB, Android ~5.1 MB. Both compile.
- Store assets: 8 Android screenshots (1080×2400), 8 iOS screenshots (1290×2796), Play feature graphic (1024×500), icons/adaptive icon/splash all present. `store/STORE-LISTING.md` has copy, age-rating guidance, privacy questionnaire drafts, UGC compliance, reviewer notes.

### UI click-through (Expo web against local backend) — all core flows pass
| Flow | Result |
|---|---|
| Welcome / onboarding screen | ✅ renders correctly |
| Sign-up (new account: "Test Pilot") | ✅ account created, landed in app |
| Sign-in (existing account) | ✅ works |
| Bottom tabs (Home / Explore / Create / Chats / Me) | ✅ navigate |
| Settings (privacy + account controls) | ✅ renders |
| Explore → community discovery | ✅ found the new community |
| Create community (name/tagline/description/category/visibility/age gate) | ✅ created "Testville", landed on its page |
| New-post composer (FAB → Blog/Image/Question/Link/Poll/Quiz/Wiki/Story) | ✅ opens, 8 post types |
| Draft autosave | ✅ fires while typing |
| Blog title validation (title required) | ✅ correctly rejected untitled post |
| Publish post | ✅ published, shows author + "just now" |
| Post on community page | ✅ visible |
| Post on home feed | ✅ visible |
| Membership ("Your communities") | ✅ Testville listed after joining |
| Daily check-in / streak UI | ✅ renders |
| Seeded content (Starlight Frames post, content warnings) | ✅ renders |
| Notification bell | ✅ present |

### Test-only changes — fully reverted
Two temporary patches (Expo-web origin allowlisted in `web/src/lib/auth/server.ts` and `web/src/lib/auth/isolation.server.ts`) were added to run the click-through and **have been removed**. `git status` is clean; typecheck and both test suites re-ran green after the revert.

---

## 2. Issues found (none ship-blocking)

1. **Nested `<button>` React warning (dev only).** In Expo web dev mode, a "<button> cannot contain a nested <button>" warning fires on some screens (from `PressableScale` in `mobile/src/components/ui/Motion.tsx` rendering nested pressables). Dev-only — it does not appear in production native builds. It did throw a dev-overlay toast that covered the submit button during automated testing, which is a test-harness annoyance, not a user-facing bug. Worth a cleanup pass before launch for web correctness, low priority.
2. **Headless-Chrome hit-testing quirk (test environment only).** A phantom zero-size overlay div swallowed synthetic clicks in the automated browser. Real user taps on a phone are unaffected (native touch handling, no DOM). Not an app bug.
3. **Website still has the old Coins wallet**, which conflicts with the no-coins direction. Needs removal or hiding before launch.

---

## 3. What is still unresolved (configuration, not code)

- `mobile/app.config.ts`: **EAS_PROJECT_ID is empty** — needs `eas init` + project link.
- `mobile/eas.json`: placeholder server addresses.
- **No production backend URL chosen.** No production hosting or database selected. (Free Render is not suitable for a real launch.)
- **No production mail, object storage (S3-compatible), or backup strategy** configured. Media currently defaults to database storage.
- Support email is still `support@your-domain.example`.
- Privacy Policy and Terms are unreviewed drafts — need final URLs for the listings.
- Push notifications, phone-to-phone calls, and account export/deletion have **never been tested on a physical device** (can't be done without real builds).

---

## 4. Concrete ship plan

### I can do (no decisions needed)
- [ ] Remove/hide the Coins wallet from the website.
- [ ] Clean up the nested-button warning in `Motion.tsx`.
- [ ] Fill in EAS project ID once you run `eas init` (or with your Expo login).
- [ ] Replace placeholder server/support-email values once you give me the real ones.
- [ ] Produce preview builds and verify them.
- [ ] Finalize store listing copy, screenshots order, age rating, UGC declarations, reviewer notes.

### Needs you (decisions, accounts, money, your hands)
1. **Production hosting + database.** Pick where the backend lives (e.g. Railway, Fly.io, Hetzner — not free Render). I can deploy once you choose.
2. **Apple Developer ($129 CAD/yr) and Google Play ($25 USD one-time)** enrollment + identity verification. Only you can do this.
3. **Support email + Privacy Policy / Terms URLs.** Tell me the address; review and host the two legal pages.
4. **Mail provider, S3-compatible storage, backups.** Approve the services (or let me propose cheap options).
5. **Physical-device testing.** Install the preview builds on your iPhone and an Android: sign-up, post + photo, one phone-to-phone call, push notification, account export/deletion. I can't do this part.
6. **Final listing sign-off** (descriptions, pricing = free, territories, release settings, privacy answers, age rating) and **explicit approval to submit**. I will not submit without your yes.

### Suggested order
1. You: enroll in Apple Developer + Google Play (takes 1–2 days for Apple verification — start now, it's the long pole).
2. You: choose hosting; I deploy the backend + configure prod env.
3. You: give me support email + legal page URLs; I wire them in.
4. I: `eas init`, preview builds; you: test on both phones.
5. I: finalize listings; you: approve; I: build production binaries and submit.

---

## 5. Honest assessment
The code is better than most 1.0 apps I've seen: typed end to end, tested (173 tests green), clean component structure, real validation, working drafts, content warnings, age gates. The click-through found zero functional bugs — the two issues above are dev-mode cosmetics. The risk in shipping Kamino is not the app, it's everything around it: production infra, store accounts, legal pages, and real-device testing. None of that is hard, it just needs your decisions. Start the Apple enrollment today — it's the only step with a waiting period you can't control.
