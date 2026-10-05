import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "../db.ts";
import { billingConfig } from "./billing-rules.ts";
import {
  creditCreatorEarnings,
  payOutCreator,
  connectOnboardingUrl,
  type StripeRequest,
} from "./money.server.ts";
import {
  applyIdentityVerificationEvent,
  startAgeVerificationSession,
} from "./age-verification.server.ts";

const pg = new PGlite();
await pg.waitReady;
const directory = new URL("../../../migrations/", import.meta.url);
for (const file of readdirSync(directory).filter((f) => f.endsWith(".sql")).sort())
  await pg.exec(readFileSync(new URL(file, directory), "utf8"));
after(() => pg.close());
function adapter(run: Sql["query"]) {
  const value = (async (strings: TemplateStringsArray, ...values: unknown[]) =>
    run(strings.reduce((q, p, i) => q + (i ? `$${i}` : "") + p, ""), values)) as Sql;
  value.query = run;
  return value;
}
const sql = adapter(async <T>(q: string, p: unknown[] = []) => (await pg.query<T>(q, p)).rows);
let sequence = 0;
async function person() {
  const id = `money-${++sequence}`;
  await sql`insert into "user"(id,name,email,"emailVerified") values(${id},${id},${`${id}@example.test`},true)`;
  await sql`insert into profiles(user_id,handle,display_name,min_age_confirmed_at) values(${id},${id},${id},now())`;
  return id;
}
async function paidOrder(buyer: string, seller: string, beneficiary: string, minor: number, testMode: boolean) {
  const offer = await sql<{ id: number }>`insert into creator_offers(owner_id, kind, title, price_minor) values(${seller}, 'tip', 'A tip', ${minor}) returning id`;
  const id = `order-${++sequence}`;
  await sql`insert into billing_orders(id,buyer_id,beneficiary_id,offer_id,seller_id,kind,title,price_minor,currency,checkout_mode,status,test_mode)
    values(${id},${buyer},${beneficiary},${Number(offer[0]!.id)},${seller},'tip','A tip',${minor},'usd','payment','paid',${testMode})`;
  return id;
}

test("billing config switches to live only with the explicit mode flag and a live key", () => {
  const base = {
    KAMINO_PAYMENTS_ENABLED: "true",
    KAMINO_BILLING_ORIGIN: "https://app.example.com",
    STRIPE_WEBHOOK_SECRET: "whsec_0123456789abcdef",
  };
  // A live key without the flag stays disabled — a pasted key alone must not flip the platform.
  assert.equal(billingConfig({ ...base, STRIPE_SECRET_KEY: `sk_live_${"a".repeat(24)}` }).mode, "disabled");
  assert.equal(
    billingConfig({ ...base, STRIPE_SECRET_KEY: `sk_live_${"a".repeat(24)}`, KAMINO_BILLING_MODE: "live" }).mode,
    "live",
  );
  // Test mode unchanged.
  assert.equal(billingConfig({ ...base, STRIPE_SECRET_KEY: `sk_test_${"a".repeat(24)}` }).mode, "test");
});

test("completed live orders credit net earnings once; test orders never do", async () => {
  const creator = await person();
  const buyer = await person();
  const liveOrder = await paidOrder(buyer, creator, buyer, 1000, false);
  const testOrder = await paidOrder(buyer, creator, buyer, 1000, true);
  assert.equal(await creditCreatorEarnings(sql, liveOrder, false), true);
  assert.equal(await creditCreatorEarnings(sql, liveOrder, false), false, "credit is idempotent per order");
  assert.equal(await creditCreatorEarnings(sql, testOrder, true), false, "sandbox money is never payable");
  const rows = await sql`select gross_minor, fee_minor, net_minor from creator_earnings`;
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0]!.gross_minor), 1000);
  assert.equal(Number(rows[0]!.net_minor), 900, "10% platform fee by default");
});

function liveEnv() {
  process.env.STRIPE_SECRET_KEY = `sk_live_${"a".repeat(24)}`;
  process.env.KAMINO_PAYMENTS_ENABLED = "true";
  process.env.KAMINO_BILLING_MODE = "live";
  process.env.KAMINO_BILLING_ORIGIN = "https://app.example.com";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_0123456789abcdef";
}

test("payouts refuse outside live mode and move available earnings to a connected account", async () => {
  const creator = await person();
  const buyer = await person();
  // Outside live mode the payout always refuses, even with earnings waiting.
  process.env.STRIPE_SECRET_KEY = `sk_test_${"a".repeat(24)}`;
  process.env.KAMINO_PAYMENTS_ENABLED = "true";
  process.env.KAMINO_BILLING_ORIGIN = "https://app.example.com";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_0123456789abcdef";
  delete process.env.KAMINO_BILLING_MODE;
  const testOrder = await paidOrder(buyer, creator, buyer, 500, true);
  await creditCreatorEarnings(sql, testOrder, true);
  await assert.rejects(() => payOutCreator(sql, creator), /live billing/);

  liveEnv();
  const liveOrder = await paidOrder(buyer, creator, buyer, 2000, false);
  await creditCreatorEarnings(sql, liveOrder, false);
  const calls: { path: string; data?: URLSearchParams }[] = [];
  const api = (async (path: string, method = "GET", data?: URLSearchParams) => {
    calls.push({ path, data });
    if (path === "/v1/accounts" && method === "POST") return { id: `acct_${sequence}`, payouts_enabled: true };
    if (path.startsWith("/v1/accounts/")) return { id: path.split("/").pop(), payouts_enabled: true };
    if (path === "/v1/transfers") return { id: `tr_${sequence}` };
    throw new Error(`unexpected path ${path}`);
  }) as unknown as StripeRequest;
  const result = await payOutCreator(sql, creator, api);
  assert.equal(result.paidMinor, 1800);
  assert.ok(calls.some((call) => call.path === "/v1/transfers"));
  const payouts = await sql`select amount_minor, state from creator_payouts`;
  assert.equal(Number(payouts[0]!.amount_minor), 1800);
  assert.equal(String(payouts[0]!.state), "paid");
  const left = await sql`select count(*) as n from creator_earnings where state='available' and creator_id=${creator}`;
  assert.equal(Number(left[0]!.n), 0);
  void connectOnboardingUrl;
});

test("age verification mints a session and a verified webhook stamps the profile", async () => {
  const user = await person();
  liveEnv();
  process.env.KAMINO_AGE_VERIFICATION_ENABLED = "true";
  const api = (async (path: string, method = "GET") => {
    if (path === "/v1/identity/verification_sessions" && method === "POST")
      return { id: `vs_${sequence}`, url: "https://verify.stripe.com/session" };
    throw new Error(`unexpected path ${path}`);
  }) as unknown as StripeRequest;
  const session = await startAgeVerificationSession(sql, user, api);
  assert.ok(session.url);
  await applyIdentityVerificationEvent(sql, `vs_${sequence}`, "verified");
  const stamp = await sql`select age_verified_at from profiles where user_id=${user}`;
  assert.ok(stamp[0]!.age_verified_at);
  const rows = await sql`select status from age_verifications where user_id=${user}`;
  assert.equal(String(rows[0]!.status), "verified");
});
