import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
if (existsSync('.env')) process.loadEnvFile('.env');

// Hosting providers tell the app its own public address; use it when BETTER_AUTH_URL is not set by hand.
if (!process.env.BETTER_AUTH_URL?.trim()) {
  const fromHost =
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`) ||
    (process.env.FLY_APP_NAME && `https://${process.env.FLY_APP_NAME}.fly.dev`);
  if (fromHost) process.env.BETTER_AUTH_URL = fromHost;
}
for (const key of ['DATABASE_URL','BETTER_AUTH_SECRET','BETTER_AUTH_URL']) {
  if (!process.env[key]?.trim()) throw new Error(`Set ${key} before starting the shared server. Use npm run dev for local development.`);
}
if (!process.env.BETTER_AUTH_URL.startsWith('https://')) throw new Error('Set BETTER_AUTH_URL to the public HTTPS address.');
if (!existsSync('.output/server/index.mjs')) throw new Error('Run npm run build first.');

// Apply any database changes that are still pending. Safe to repeat: each change runs only once.
const migrate = spawnSync(process.execPath, ['scripts/migrate.mjs'], { stdio: 'inherit', env: process.env });
if (migrate.status !== 0) throw new Error('Database migration failed; not starting the server.');

const child=spawn(process.execPath,['.output/server/index.mjs'],{stdio:'inherit',env:{...process.env,NODE_ENV:'production'}});
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
