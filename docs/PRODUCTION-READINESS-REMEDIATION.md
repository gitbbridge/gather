# Gather production-readiness remediation

**Updated:** November 12, 2026
**Source audit:** `GATHER_PRODUCTION_READINESS_AUDIT.md` (November 10, 2026)

This file tracks the eight audit findings that caused failed or blocked scenarios. A finding is resolved only when its correction and verification evidence both exist. Production is not changed by this work.

| ID | Why it was blocked or failed | Required correction | Current status and evidence |
| --- | --- | --- | --- |
| AUD-001 | Auth, database, email, and payment testing shared external resources, so mutations were unsafe. | Isolated staging hosting, Supabase, D1, Stripe test mode, test-only email, role accounts, and fixtures. | **In progress.** Sandbox hosting is separate and public; the staging isolation validator passes; Sites exposes a separate `DB` binding with the expected D1 tables; staging Supabase and organizer/bidder accounts exist. Disposable authenticated auctions, registrations, bids, homepage publishing, and closeout records now execute against staging Auth plus local D1. Hosted D1 fixture seeding and payment/travel fixtures remain. |
| AUD-002 | Integration scripts used the retired `/signin-with-chatgpt` route and a hard-coded origin. | Use staging Supabase Auth, a configurable origin, disposable local D1 state, and deterministic fixtures. | **Resolved.** The staging-only session helper authenticates through Supabase and prepares explicit organizer/supporter roles. The configurable-origin integration suite passes nonprofit isolation, anonymous browsing, registration, bidding, homepage publishing, and closeout scenarios without production access. |
| AUD-003 | TypeScript reported unsafe live-lot values, an incompatible Stripe setup field, sandbox form types, a fee-policy compatibility warning, and an old regex target. | Correct the types and preserve runtime validation. | **Resolved.** `npx tsc --noEmit --incremental false` exits 0 at commit `f63fca0`; 29 affected tests passed. |
| AUD-004 | ESLint scanned design references and treated intentional Vinext navigation and async loader patterns as release errors, alongside real unsafe types and impure render calls. | Scope the application gate, fix correctness findings, and retain advisory warnings. | **Resolved as a release gate.** `npm run lint` exits 0 with no errors at commit `7a3b4ca`. Advisory warnings remain visible for incremental cleanup. |
| AUD-005 | The Gather Live projector treated permanent 404/403 responses like temporary network failures. | Stop polling on permanent failures and render a terminal error with a safe exit. | **Resolved.** Commit `856b6a5`; focused lint, TypeScript, and eight live-display tests pass. |
| AUD-006 | No maintained browser E2E suite or reliable mobile role fixtures existed. | Add staging-backed browser tests for public, organizer, bidder, administrator, payments, and mobile layouts. | **In progress.** A production-refusing Playwright suite covers the approved homepage, About Give Holidays navigation, help/legal/support availability, signed-out organizer routing, authenticated organizer/supporter/platform-administrator routing, the Give Holidays catalog and travel-fulfillment pages, and overflow at desktop and mobile sizes. The authenticated role suite passes on desktop and mobile. Payment browser coverage remains and depends on Stripe Connect activation. |
| AUD-007 | Hosted production URL, Supabase, Stripe, Resend, redirects, webhook, and MFA settings were not compared with an explicit manifest. | Verify non-secret hosting values and external provider settings; document promotion checks. | **In progress.** A no-secret baseline/launch validator and provider checklist now define the production manifest. Production `APP_URL` and the approved Supabase project match; Stripe remains in test mode. Supabase redirects, Resend sender verification, Stripe live webhook, live keys, and MFA enrollment still require provider-side confirmation before the strict launch gate can pass. |
| AUD-008 | Checkout, signed webhooks, retries, refunds, idempotency, and fulfillment lacked a disposable full-stack path. | Seed staging invoices/Connect data and execute Stripe test-mode lifecycle assertions. | **In progress.** Webhook intake now atomically claims events, suppresses concurrent/processed duplicates, retries failed events, and recovers abandoned processing leases. The organizer onboarding routes now use the Stripe Express Connect API supported by the configured account, and connection-state tests pass. A test-mode API probe confirmed the code reaches Stripe, but Stripe rejects connected-account creation until Connect is activated for the platform. Full checkout, signed delivery, refund, settlement, and fulfillment execution still depends on Connect activation and staging payment/travel fixtures. |

## Repair order

1. Apply the forward-only pgcrypto search-path migration to staging and confirm auction synchronization (`AUD-001`).
2. Seed hosted D1 invoice and travel fixtures (`AUD-001`).
3. Add authenticated browser/mobile role coverage (`AUD-006`).
4. Activate Stripe Connect for the platform, then execute test checkout, webhook duplication, failure, retry, refund, settlement, and fulfillment (`AUD-008`).
5. Finish provider-side production configuration verification (`AUD-007`).
6. Repeat the audit and retain evidence before any real-money launch decision.

## Required external action

Apply `202611120001_fix_pgcrypto_function_resolution.sql` to the isolated staging Supabase project. Do not apply it to production until staging synchronization has been verified and a separate production migration is explicitly authorized.

Activate Connect in the Stripe Dashboard for the configured platform account at `https://dashboard.stripe.com/connect`. This is required before Stripe permits Gather to create even test-mode Express connected accounts. No live-mode keys or payments are required for this staging step.
