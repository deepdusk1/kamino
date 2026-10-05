/**
 * Creator money: earnings ledger and payouts to creators via Stripe Connect (Express).
 *
 * Earnings are credited from the webhook path whenever an order completes — every completed
 * order's gross is split into a platform fee (`KAMINO_PLATFORM_FEE_PERCENT`, default 10) and the
 * creator's net. Payouts move net earnings to the creator's connected account with a Stripe
 * transfer. Real money only moves when billing runs in live mode; in test mode everything is
 * tracked but `requestPayout` refuses, exactly like checkout.
 *
 * The Stripe calls follow the same injectable `StripeRequest` shape as `billing.server.ts`, so
 * the tests run against a stub.
 */
import type { Sql } from "../db.ts";
import { billingConfig } from "./billing-rules.ts";
import type { StripeRequest } from "./billing.server.ts";
export type { StripeRequest };

type BillingConfigLite = ReturnType<typeof billingConfig>;

const getBillingConfig = (): BillingConfigLite => billingConfig(process.env);

/** The provider request builder lives in billing.server; loaded lazily to stay test-light. */
async function defaultApi(config: BillingConfigLite): Promise<StripeRequest> {
  const { stripeRequest } = await import("./billing.server.ts");
  return stripeRequest(config);
}

type Row = Record<string, unknown>;

export const DEFAULT_PLATFORM_FEE_PERCENT = 10;

export function platformFeePercent(): number {
  const raw = process.env.KAMINO_PLATFORM_FEE_PERCENT?.trim();
  const fee = raw ? Number(raw) : Number.NaN;
  return Number.isInteger(fee) && fee >= 0 && fee <= 50 ? fee : DEFAULT_PLATFORM_FEE_PERCENT;
}

/** Idempotent: one earnings row per order. Called from the webhook persist path. */
export async function creditCreatorEarnings(sql: Sql, orderId: string, testMode: boolean): Promise<boolean> {
  // Sandbox money never becomes payable, so only real-mode orders earn a balance.
  if (testMode) return false;
  const order = (await sql<Row>`
    select id, beneficiary_id, seller_id, price_minor, currency, status
    from billing_orders where id = ${orderId} and status = 'paid'`)[0];
  if (!order) return false;
  const gross = Number(order.price_minor ?? 0);
  if (gross <= 0) return false;
  const fee = Math.floor((gross * platformFeePercent()) / 100);
  const inserted = await sql`
    insert into creator_earnings(creator_id, order_id, gross_minor, fee_minor, net_minor, currency, state)
    values(${String(order.seller_id)}, ${String(order.id)}, ${gross}, ${fee}, ${gross - fee}, ${String(order.currency)}, 'available')
    on conflict (order_id) do nothing returning id`;
  return inserted.length > 0;
}

type PayoutAccount = { id: string; charges_enabled: boolean; payouts_enabled: boolean };

async function ensureConnectAccount(
  sql: Sql,
  userId: string,
  api: StripeRequest,
  live: boolean,
): Promise<PayoutAccount> {
  const existing = (
    await sql<Row>`select stripe_account_id from creator_payout_accounts where user_id = ${userId}`
  )[0];
  if (existing?.stripe_account_id) {
    const account = (await api(`/v1/accounts/${String(existing.stripe_account_id)}`)) as PayoutAccount;
    return account;
  }
  const account = (await api("/v1/accounts", "POST", new URLSearchParams({ type: "express" }))) as PayoutAccount;
  await sql`insert into creator_payout_accounts(user_id, stripe_account_id, live_mode)
    values(${userId}, ${String(account.id)}, ${live})
    on conflict (user_id) do update set stripe_account_id = excluded.stripe_account_id, live_mode = excluded.live_mode, updated_at = now()`;
  return account;
}

// ── The three member-facing operations ──────────────────────────────────────

export async function creatorMoneySummary(sql: Sql, userId: string) {
    const config = getBillingConfig();
    const summary = (await sql<Row>`
      select coalesce(sum(case when state='available' then net_minor else 0 end), 0) as available,
             coalesce(sum(net_minor), 0) as lifetime, currency
      from creator_earnings where creator_id = ${userId} group by currency limit 1`)[0];
    const payouts = await sql<Row>`
      select id, amount_minor, currency, state, created_at, updated_at, error
      from creator_payouts where creator_id = ${userId} order by id desc limit 20`;
    const account = (
      await sql<Row>`select stripe_account_id, live_mode from creator_payout_accounts where user_id = ${userId}`
    )[0];
    return {
      billingReason: config.reason,
      billingMode: config.mode,
      connected: Boolean(account?.stripe_account_id),
      availableMinor: Number(summary?.available ?? 0),
      lifetimeMinor: Number(summary?.lifetime ?? 0),
      currency: String(summary?.currency ?? "usd"),
      feePercent: platformFeePercent(),
      payouts: payouts.map((row) => ({
        id: Number(row.id),
        amountMinor: Number(row.amount_minor),
        currency: String(row.currency),
        state: String(row.state),
        error: String(row.error ?? ""),
        createdAt: String(row.created_at),
      })),
    };
}

/** Connect onboarding link (testable core of the RPC op below). */
export async function connectOnboardingUrl(sql: Sql, userId: string, api?: StripeRequest): Promise<{ url: string }> {
  const config = getBillingConfig();
  if (!config.enabled) throw new Error(config.reason);
  const request = api ?? (await defaultApi(config));
  const account = await ensureConnectAccount(sql, userId, request, config.mode === "live");
  const origin = config.origin;
  const link = (await request(
    "/v1/account_links",
    "POST",
    new URLSearchParams({
      account: String(account.id),
      refresh_url: `${origin}/creator`,
      return_url: `${origin}/creator`,
      type: "account_onboarding",
    }),
  )) as { url?: string };
  if (!link.url) throw new Error("The payment provider did not return an onboarding link.");
  return { url: link.url };
}

/** Moves all available earnings to the creator's connected account (testable core). */
export async function payOutCreator(sql: Sql, userId: string, api?: StripeRequest): Promise<{ paidMinor: number; currency: string }> {
  const config = getBillingConfig();
  if (!config.enabled) throw new Error(config.reason);
  if (config.mode !== "live")
    throw new Error("Payouts need live billing. Test-mode earnings stay in the sandbox.");
  const request = api ?? (await defaultApi(config));
  const account = await ensureConnectAccount(sql, userId, request, true);
  if (!account.payouts_enabled)
    throw new Error("Finish the payout onboarding first — the provider has not enabled your account yet.");
  const available = (await sql<Row>`
    select coalesce(sum(net_minor), 0) as total, min(currency) as currency
    from creator_earnings where creator_id = ${userId} and state = 'available'`)[0];
  const total = Number(available?.total ?? 0);
  if (total <= 0) throw new Error("No available earnings to pay out yet.");
  const transfer = (await request(
    "/v1/transfers",
    "POST",
    new URLSearchParams({
      amount: String(total),
      currency: String(available?.currency ?? "usd"),
      destination: String(account.id),
    }),
    `kamino-payout-${userId}-${total}`,
  )) as { id?: string };
  const inserted = await sql`
    update creator_earnings set state = 'paid'
    where creator_id = ${userId} and state = 'available' returning id`;
  if (!inserted.length) throw new Error("No available earnings to pay out yet.");
  await sql`insert into creator_payouts(creator_id, amount_minor, currency, state, stripe_account_id, stripe_transfer_id)
    values(${userId}, ${total}, ${String(available?.currency ?? "usd")}, 'paid', ${String(account.id)}, ${String(transfer.id ?? "")})`;
  return { paidMinor: total, currency: String(available?.currency ?? "usd") };
}
