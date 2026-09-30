/**
 * Talking to the two free AI services Kamino can use. Both are optional: without keys, Kamino still runs, the
 * built-in safety rules still apply, and the role-play screens say that the AI storyteller is not set up.
 *
 *   Moderation  – OpenAI's moderation service (free of charge; needs an OpenAI API key). Checks text and pictures.
 *                 KAMINO_MODERATION_API_KEY (or OPENAI_API_KEY), optional KAMINO_MODERATION_URL.
 *   Storyteller – any "OpenAI-compatible" chat service. The default is Groq's free tier.
 *                 KAMINO_AI_API_KEY (or GROQ_API_KEY), optional KAMINO_AI_BASE_URL, KAMINO_AI_MODEL,
 *                 KAMINO_AI_DAILY_LIMIT (default 900 replies a day, under Groq's free 1,000).
 *
 * Nothing here ever throws on a moderation failure: a slow or broken service must not stop people from posting.
 */
import type { Sql } from "@/lib/db";

type Env = Record<string, string | undefined>;

export type AiConfig = {
  moderation: { url: string; key: string; model: string } | null;
  chat: { url: string; key: string; model: string; dailyLimit: number } | null;
};

const trimSlash = (url: string) => url.replace(/\/+$/, "");

export function aiConfigFrom(env: Env): AiConfig {
  const moderationKey = (env.KAMINO_MODERATION_API_KEY || env.OPENAI_API_KEY || "").trim();
  const chatKey = (env.KAMINO_AI_API_KEY || env.GROQ_API_KEY || "").trim();
  const limit = Number(env.KAMINO_AI_DAILY_LIMIT ?? 900);
  return {
    moderation: moderationKey
      ? {
          url: trimSlash(env.KAMINO_MODERATION_URL?.trim() || "https://api.openai.com/v1"),
          key: moderationKey,
          model: env.KAMINO_MODERATION_MODEL?.trim() || "omni-moderation-latest",
        }
      : null,
    chat: chatKey
      ? {
          url: trimSlash(env.KAMINO_AI_BASE_URL?.trim() || "https://api.groq.com/openai/v1"),
          key: chatKey,
          model: env.KAMINO_AI_MODEL?.trim() || "openai/gpt-oss-20b",
          dailyLimit: Number.isFinite(limit) && limit >= 0 ? Math.floor(limit) : 900,
        }
      : null,
  };
}

export const aiConfig = (): AiConfig => aiConfigFrom(process.env);

async function postJson(
  url: string,
  key: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scores one piece of text or one picture (a data: URL). Returns the score per category, or null when moderation is
 * switched off or the service did not answer in time.
 */
export async function moderationScores(
  input: { text: string } | { image: string },
): Promise<Record<string, number> | null> {
  const config = aiConfig().moderation;
  if (!config) return null;
  const item =
    "text" in input
      ? { type: "text", text: input.text.slice(0, 8000) }
      : { type: "image_url", image_url: { url: input.image } };
  try {
    const res = await postJson(
      `${config.url}/moderations`,
      config.key,
      { model: config.model, input: [item] },
      6000,
    );
    if (!res.ok) {
      console.warn(`[moderation] service answered ${res.status}; the built-in rules still apply`);
      return null;
    }
    const body = (await res.json()) as { results?: { category_scores?: Record<string, number> }[] };
    return body.results?.[0]?.category_scores ?? null;
  } catch (error) {
    console.warn(
      "[moderation] service unreachable; the built-in rules still apply",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** A friendly error for people (shown as-is in the apps). */
export class AiUnavailableError extends Error {}

/** Counts one storyteller reply against today's budget. Returns false when the budget is used up. */
async function takeBudget(sql: Sql, limit: number): Promise<boolean> {
  const rows = await sql<{ calls: number }>`
    insert into ai_usage (day, calls) values ((now() at time zone 'UTC')::date, 1)
    on conflict (day) do update set calls = ai_usage.calls + 1
    returning calls
  `;
  return Number(rows[0]?.calls ?? 0) <= limit;
}

/** How many storyteller replies are left today (for the apps to show). */
export async function budgetLeft(sql: Sql): Promise<number> {
  const config = aiConfig().chat;
  if (!config) return 0;
  const used = Number(
    (
      await sql<{
        calls: number;
      }>`select calls from ai_usage where day = (now() at time zone 'UTC')::date`
    )[0]?.calls ?? 0,
  );
  return Math.max(0, config.dailyLimit - used);
}

/** Default token budget for a storyteller reply. Reasoning models (the default gpt-oss-20b
 * spends tokens thinking before it writes) need headroom: a tight limit leaves nothing for the
 * reply itself, which comes back empty. Regression guard: keep this >= 1000. */
export const STORYTELLER_DEFAULT_TOKENS = 1200;
/** Asks the storyteller for a reply. Throws `AiUnavailableError` with a message people can read. */
export async function chatComplete(
  sql: Sql,
  messages: ChatMessage[],
  options: { maxTokens?: number } = {},
): Promise<string> {
  const config = aiConfig().chat;
  if (!config) throw new AiUnavailableError("The AI storyteller is not set up on this server yet.");
  if (!(await takeBudget(sql, config.dailyLimit)))
    throw new AiUnavailableError(
      "The AI storyteller has used today's free replies. It will be back tomorrow.",
    );
  // Reasoning models (the default gpt-oss-20b spends tokens thinking before it writes) need
  // headroom: a tight limit leaves nothing for the reply itself, which comes back empty.
  const maxTokens = options.maxTokens ?? STORYTELLER_DEFAULT_TOKENS;
  let lastError: AiUnavailableError | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let res: Response;
    try {
      res = await postJson(
        `${config.url}/chat/completions`,
        config.key,
        { model: config.model, messages, max_tokens: maxTokens, temperature: 0.9 },
        30_000,
      );
    } catch {
      lastError = new AiUnavailableError("The AI storyteller did not answer. Try again in a moment.");
      continue;
    }
    if (res.status === 429)
      throw new AiUnavailableError("The AI storyteller is busy right now. Try again in a minute.");
    if (!res.ok) {
      console.warn(`[ai] storyteller answered ${res.status}`);
      lastError = new AiUnavailableError("The AI storyteller could not answer. Try again in a moment.");
      continue;
    }
    const body = (await res.json()) as {
      choices?: { finish_reason?: string; message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (text) return text;
    console.warn(
      `[ai] storyteller returned empty content (attempt ${attempt}, finish_reason=${body.choices?.[0]?.finish_reason ?? "unknown"}, max_tokens=${maxTokens})`,
    );
    lastError = new AiUnavailableError("The AI storyteller had nothing to say. Try again.");
  }
  throw lastError ?? new AiUnavailableError("The AI storyteller had nothing to say. Try again.");
}
