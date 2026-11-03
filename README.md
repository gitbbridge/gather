Gather — nonprofit silent auction app
Working private test application built with React, TypeScript, Tailwind CSS 4, accessible Radix/Shadcn controls, Vinext, and Cloudflare D1.

Current status
This is a functional test foundation, not approved for real-money production auctions. Every bid, donation, and buy-now reservation is labeled as test activity. Payments are intentionally not collected. Site access is owner-private.

Approved product and revenue direction
Gather charges a 5% platform commission on eligible auction transactions. Organizers can cover it, pass it to winning bidders, or split it with a configurable allocation.
Payment processing fees are separate from the platform commission and must be disclosed separately to the responsible payer.
Give Holidays travel packages carry a separate package markup included in their displayed package pricing.
Organizer onboarding follows five autosaved steps: Organization → Auction Details → Add Items → Payment & Fees → Review & Launch. Each step keeps one primary action and the existing Gather visual direction.
Implemented
Responsive bidder and organizer shell; searchable catalog, categories, sorting, item details and donor credits.
ChatGPT sign-in, server authorization for organizer operations, multiple organizer-owned auctions.
Durable auction state, watchlists, private maximum bidding, minimum increments, earlier-bid tie handling, two-minute anti-sniping extensions.
Atomic compare-and-swap updates and request-key deduplication at the API boundary.
In-app outbid notifications with 15-second refresh.
Test donations and buy-now reservations, goal totals, item creation, pause/resume, naming, and CSV item reports.
Tenant-scoped Homepage Builder with structured responsive sections, live device previews, autosaved drafts, undo/redo, publish validation, and explicit draft-to-published promotion.
Organizer Closeout workflow with participant rollups, operational statuses, follow-up drafts, and a master CSV export.
Seven bidding-engine unit tests, type checking, production Worker build, and local workflow checks.
Run
Node.js 22.13+ required. npm install, npm run db:generate when changing the schema, npm run build, then apply local migrations as documented in README.md. npm run dev starts the app. node --experimental-strip-types --test tests/auction.test.mts runs the bidding tests; npx tsc --noEmit checks types.

Required before public launch
Confirm one nonprofit versus a multi-tenant SaaS business, country/currency, nonprofit onboarding, branding and auction rules.
Integrate public bidder identity and account recovery using a supported public auth provider. Current sign-in uses the Sites ChatGPT identity path. Add tenant memberships and organizer role management.
Connect a payment provider (e.g. Stripe Connect for multi-nonprofit payouts), hosted checkout, verified webhook signatures, idempotent settlement, refunds, receipts, payout reconciliation and failed-payment handling. Never store card details in this app.
Replace the bounded JSON auction aggregate with normalized event/item/bid/order tables and transaction-safe per-item serialization for expected scale. Current aggregate caps each auction at 200 items, 10,000 write requests and 900 KB; it is suitable for a test foundation, not large production events.
Add durable job scheduling for finalization, winner notification, payment collection, inventory fulfillment and event status transitions. No automatic winner settlement currently runs.
Connect email/SMS providers with consent, deliverability, unsubscribe controls and a transactional outbox. Current notifications exist only inside the app.
Add donor intake, image upload/moderation, item editing, configurable schedules, reserve prices, shipping/pickup, event tickets, sponsor branding and tax-receipt rules as required by the actual nonprofit.
Add production rate limiting, audit logging, monitoring/alerts, backups and restore drills, privacy/retention controls, accessibility audit, abuse handling, security review and multi-user concurrency/load testing.
Validate end-to-end payment and dispute flows in sandbox, then complete nonprofit approval and a controlled live launch.
Data and security notes
The API uses integer cents, prepared SQL, same-origin mutation checks, trusted platform identity, explicit ownership checks for organizer actions and a version predicate for atomic aggregate updates. Maximum bids and bidder IDs are removed from the public response. Amounts displayed as commitments include uncollected bids and test donations, never actual revenue. Production should deduplicate retries using stable client operation keys across network failures; this preview generates a key per submission. Sample auction deadlines are generated for preview; created auction deadlines persist.

Photos are illustrative Unsplash images by Ali Kazal, Elevate, Greg Rosenke, and Clay Banks. Source links are available in the app’s About dialog. Sample nonprofits and donors are fictional.


# vinext-starter

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For browser QA on managed Linux, use `sites-preview start`. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Supabase authentication and schema

Gather can use Supabase Auth while the existing D1 data layer is migrated in stages.

1. Copy `.env.example` to `.env.local` and add the project's publishable key.
2. Apply `supabase/migrations/202611030001_initial_auth_and_auction_schema.sql` in the Supabase SQL editor, or link the project and run `supabase db push`.
   Then apply `supabase/migrations/202611030002_mvp_operations_and_fulfillment.sql` for platform-admin roles, the Give Holidays catalog, auction terms, watchlists, winner invoices, refunds, Stripe event processing, and fulfillment tracking.
3. Add `http://localhost:5173/auth/callback` as an allowed Auth redirect URL for local email confirmation.
   Password recovery uses the same callback and then continues to `/auth/update-password`. Add the production callback URL after the public domain is connected.
4. Restart the development server after changing environment variables.

The migration enables Row Level Security, creates auth-linked profiles, nonprofit organizations and memberships, normalized auctions and items, bidder registrations and bids, and transaction fields that keep the 5% platform commission, payment-processing fees, and Give Holidays markup separately auditable. Full EIN values are intentionally not stored; the payment provider should collect them.

## Stripe webhook development

Add the test-mode Stripe keys and the CLI listener's signing secret to `.env.local`, then restart the development server. Forward only the events Gather is preparing to handle:

```sh
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,payment_intent.succeeded,payment_intent.payment_failed,charge.refunded --forward-to http://localhost:5173/api/stripe/webhook
```

The signing secret printed by that command belongs in `STRIPE_WEBHOOK_SECRET`. The webhook verifies the unmodified request body and `Stripe-Signature`, stores only minimal event metadata, and ignores replayed event IDs. It currently accepts events for later processing; payment settlement and fulfillment must not be enabled until event-specific handlers are implemented and tested.

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
