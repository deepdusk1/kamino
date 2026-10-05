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
