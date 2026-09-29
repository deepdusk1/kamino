/**
 * The set of server functions the native apps may call over `/api/v1/rpc/<name>`.
 *
 * Built automatically from every server function exported by `./server`,
 * `./extras`, `./engagement` and `./library`, so a new feature is reachable from mobile without a second
 * registration step. Only real server functions qualify: plain helper functions
 * that happen to be exported (there are none today) are never exposed.
 */
import * as core from "./server";
import * as extras from "./extras";
import * as engagement from "./engagement";
import * as library from "./library";

type ServerFn = (opts: { data?: unknown }) => Promise<unknown>;

function isServerFn(value: unknown): value is ServerFn {
  return typeof value === "function" && "__executeServer" in value;
}

export const mobileApi: Record<string, ServerFn> = Object.fromEntries(
  [...Object.entries(core), ...Object.entries(extras), ...Object.entries(engagement), ...Object.entries(library)].filter(([, value]) => isServerFn(value)),
);
