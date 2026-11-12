# Gather production-readiness remediation

**Updated:** November 12, 2026  
**Source audit:** `GATHER_PRODUCTION_READINESS_AUDIT.md` (November 10, 2026)

This file tracks the eight audit findings that caused failed or blocked scenarios. A finding is resolved only when its correction and verification evidence both exist. Production is not changed by this work.

| ID | Why it was blocked or failed | Required correction | Current status and evidence |
| --- | --- | --- | --- |
| AUD-001 | Auth, database, email, and payment testing shared external resources, so mutations were unsafe. | Isolated staging hosting, Supabase, D1, Stripe test mode, test-only email, role accounts, and fixtures. | **In progress.** Sandbox hosting is separate and public; the staging isolation validator passes; Sites exposes a separate `DB` binding with the expected D1 tables; staging Supabase and test accounts exist. Authenticated fixture workflows still need execution. |
| AUD-002 | Integration scripts used the retired `/signin-with-chatgpt` route and a hard-coded origin. | Use staging Supabase Auth, a configurable origin, disposable local D1 state, and deterministic fixtures. | **In progress.** Scripts now use a staging-only Supabase session helper and configurable `GATHER_TEST_ORIGIN`. Execution awaits the local untracked `SANDBOX_DEMO_PASSWORD`. |
| AUD-003 | TypeScript reported unsafe live-lot values, an incompatible Stripe setup field, sandbox form types, a fee-policy compatibility warning, and an old regex target. | Correct the types and preserve runtime validation. | **Resolved.** `npx tsc --noEmit --incremental false` exits 0 at commit `f63fca0`; 29 affected tests passed. |
| AUD-004 | ESLint scanned design references and treated intentional Vinext navigation and async loader patterns as release errors, alongside real unsafe types and impure render calls. | Scope the application gate, fix correctness findings, and retain advisory warnings. | **Resolved as a release gate.** `npm run lint` exits 0 with no errors at commit `7a3b4ca`. Advisory warnings remain visible for incremental cleanup. |
| AUD-005 | The Gather Live projector treated permanent 404/403 responses like temporary network failures. | Stop polling on permanent failures and render a terminal error with a safe exit. | **Resolved.** Commit `856b6a5`; focused lint, TypeScript, and eight live-display tests pass. |
| AUD-006 | No maintained browser E2E suite or reliable mobile role fixtures existed. | Add staging-backed browser tests for public, organizer, bidder, administrator, payments, and mobile layouts. | **Pending AUD-002.** Build after authenticated integration sessions are executable. |
| AUD-007 | Hosted production URL, Supabase, Stripe, Resend, redirects, webhook, and MFA settings were not compared with an explicit manifest. | Verify non-secret hosting values and external provider settings; document promotion checks. | **Partially verified.** Production `APP_URL` and the approved Supabase project match; Stripe remains in test mode; production code enforces MFA by default. Supabase redirects, Resend sender verification, and the Stripe webhook endpoint still require provider-side confirmation. |
| AUD-008 | Checkout, signed webhooks, retries, refunds, idempotency, and fulfillment lacked a disposable full-stack path. | Seed staging invoices/Connect data and execute Stripe test-mode lifecycle assertions. | **Pending AUD-001/AUD-002.** Begin after authenticated staging fixtures run successfully. |

## Repair order

1. Complete and execute staging-auth integration tests (`AUD-002`).
2. Seed isolated organizer, bidder, auction, invoice, and travel fixtures (`AUD-001`).
3. Add browser/mobile role coverage (`AUD-006`).
4. Execute Stripe test checkout, webhook duplication, failure, retry, refund, settlement, and fulfillment (`AUD-008`).
5. Finish provider-side production configuration verification (`AUD-007`).
6. Repeat the audit and retain evidence before any real-money launch decision.

## Required local action

Add `SANDBOX_DEMO_PASSWORD` to the untracked `.env.staging.local` file. Use the existing sandbox-account password and do not commit or paste it into source. Then run `npm run test:integration:staging` while the staging-configured local server is running on `GATHER_TEST_ORIGIN`.
