/**
 * The set of server functions the native apps may call over `/api/v1/rpc/<name>`.
 *
 * Built automatically from every server function exported by `./server`,
 * `./extras`, `./engagement`, `./library`, `./ai-features` and `./social`, so a new feature is reachable from mobile without a second
 * registration step. Only real server functions qualify: plain helper functions
 * that happen to be exported (there are none today) are never exposed.
 */
import * as core from "./server";
import * as extras from "./extras";
import * as engagement from "./engagement";
import * as library from "./library";
import * as aiFeatures from "./ai-features";
import * as social from "./social";
import * as identity from "./identity-v9";
import * as communityTools from "./community-v9";
import * as contentTools from "./content-v9";
import * as platformTools from "./platform-v9";
import * as billing from "./billing-v9";
import * as siteReports from "./site-reports";
import * as platformAnalytics from "./platform-analytics";
import * as profileStories from "./profile-stories";

type ServerFn = ((opts: { data?: unknown }) => Promise<unknown>) & { method?: string };

function isServerFn(value: unknown): value is ServerFn {
  return typeof value === "function" && "__executeServer" in value;
}

export const mobileApi: Record<string, ServerFn> = Object.fromEntries(
  [core, extras, engagement, library, aiFeatures, social, identity, communityTools, contentTools, platformTools, billing, siteReports, platformAnalytics, profileStories]
    .flatMap(module => Object.entries(module)).filter(([, value]) => isServerFn(value)),
);
