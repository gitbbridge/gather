# Gather — nonprofit silent auction app

Working private test application built with React, TypeScript, Tailwind CSS 4, accessible Radix/Shadcn controls, Vinext, and Cloudflare D1.

## Current status

This is a functional test foundation, **not approved for real-money production auctions**. Every bid, donation, and buy-now reservation is labeled as test activity. Payments are intentionally not collected. Site access is owner-private.

## Approved product and revenue direction

- Gather charges a 5% platform commission on eligible auction transactions. Organizers can cover it, pass it to winning bidders, or split it with a configurable allocation.
- Payment processing fees are separate from the platform commission and must be disclosed separately to the responsible payer.
- Give Holidays travel packages carry a separate package markup included in their displayed package pricing.
- Organizer onboarding follows five autosaved steps: Organization → Auction Details → Add Items → Payment & Fees → Review & Launch. Each step keeps one primary action and the existing Gather visual direction.

## Implemented

- Responsive bidder and organizer shell; searchable catalog, categories, sorting, item details and donor credits.
- ChatGPT sign-in, server authorization for organizer operations, multiple organizer-owned auctions.
- Durable auction state, watchlists, private maximum bidding, minimum increments, earlier-bid tie handling, two-minute anti-sniping extensions.
- Atomic compare-and-swap updates and request-key deduplication at the API boundary.
- In-app outbid notifications with 15-second refresh plus tracked Resend delivery for bid confirmations, outbid alerts, winner invoices, payment receipts, and Give Holidays claim updates.
- Test donations and buy-now reservations, goal totals, item creation, pause/resume, naming, and CSV item reports.
- Tenant-scoped Homepage Builder with structured responsive sections, live device previews, autosaved drafts, undo/redo, publish validation, and explicit draft-to-published promotion.
- Organizer Closeout workflow with participant rollups, operational statuses, follow-up drafts, and a master CSV export.
- Seven bidding-engine unit tests, type checking, production Worker build, and local workflow checks.

## Run

Node.js 22.13+ required. `npm install`, `npm run db:generate` when changing the schema, `npm run build`, then apply local migrations as documented in `README.md`. `npm run dev` starts the app. `node --experimental-strip-types --test tests/auction.test.mts` runs the bidding tests; `npx tsc --noEmit` checks types.

## Required before public launch

1. Confirm one nonprofit versus a multi-tenant SaaS business, country/currency, nonprofit onboarding, branding and auction rules.
2. Integrate public bidder identity and account recovery using a supported public auth provider. Current sign-in uses the Sites ChatGPT identity path. Add tenant memberships and organizer role management.
3. Connect a payment provider (e.g. Stripe Connect for multi-nonprofit payouts), hosted checkout, verified webhook signatures, idempotent settlement, refunds, receipts, payout reconciliation and failed-payment handling. Never store card details in this app.
4. Replace the bounded JSON auction aggregate with normalized event/item/bid/order tables and transaction-safe per-item serialization for expected scale. Current aggregate caps each auction at 200 items, 10,000 write requests and 900 KB; it is suitable for a test foundation, not large production events.
5. Add durable job scheduling for finalization, winner notification, payment collection, inventory fulfillment and event status transitions. No automatic winner settlement currently runs.
6. Complete scheduled retry processing and monitoring for the email delivery log; add push notifications only after consent and device-token handling are designed. Transactional Resend email is connected for core bidding, payment, and travel events.
7. Add donor intake, image upload/moderation, item editing, configurable schedules, reserve prices, shipping/pickup, event tickets, sponsor branding and tax-receipt rules as required by the actual nonprofit.
8. Add production rate limiting, audit logging, monitoring/alerts, backups and restore drills, privacy/retention controls, accessibility audit, abuse handling, security review and multi-user concurrency/load testing.
9. Validate end-to-end payment and dispute flows in sandbox, then complete nonprofit approval and a controlled live launch.

## Data and security notes

The API uses integer cents, prepared SQL, same-origin mutation checks, trusted platform identity, explicit ownership checks for organizer actions and a version predicate for atomic aggregate updates. Maximum bids and bidder IDs are removed from the public response. Amounts displayed as commitments include uncollected bids and test donations, never actual revenue. Production should deduplicate retries using stable client operation keys across network failures; this preview generates a key per submission. Sample auction deadlines are generated for preview; created auction deadlines persist.

Photos are illustrative Unsplash images by Ali Kazal, Elevate, Greg Rosenke, and Clay Banks. Source links are available in the app’s About dialog. Sample nonprofits and donors are fictional.
