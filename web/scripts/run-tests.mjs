import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
// The ZIP also contains tests of its original app-generator environment.
// Keep those runnable explicitly without treating platform fixtures as Kamino requirements.
const files=process.argv.includes('--legacy')
  ? readdirSync('scripts').filter(f=>f.endsWith('.test.mjs')).map(f=>'scripts/'+f)
  : ['scripts/sign-out-plan.test.mjs'];
files.push('scripts/backup-lib.test.mjs','src/lib/app-data/app-data.test.ts','src/lib/app-data/readiness-schedule.test.ts','src/lib/auth/gate-identity.test.ts','src/lib/auth/sign-in-gate.test.ts','src/lib/kamino/feeds.test.ts','src/lib/kamino/rate-limit.test.ts','src/lib/kamino/age.test.ts','src/lib/kamino/ice.test.ts','src/lib/kamino/stickers.test.ts','src/lib/kamino/cosmetics.test.ts','src/lib/kamino/albums.test.ts','src/lib/kamino/theme.test.ts','src/lib/kamino/sigv4.test.ts','src/lib/kamino/media-store.test.ts','src/lib/kamino/moderation.test.ts','src/lib/kamino/roleplay.test.ts','src/lib/kamino/storyteller-budget.test.ts','src/lib/kamino/achievements.test.ts');
const result=spawnSync(process.execPath,['--experimental-strip-types','--test',...files],{stdio:'inherit'});
process.exit(result.status??1);
