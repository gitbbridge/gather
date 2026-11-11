# Gather security policy

## Reporting a vulnerability

Do not include passwords, API keys, payment information, or supporter records in a report. Send a concise description and reproduction steps to `security@gatherforgood.bid`. Do not test against real nonprofit or bidder data.

## Production controls

- Supabase authentication and Row-Level Security protect tenant data.
- Supabase secret keys, Stripe secret keys, webhook secrets, and Resend keys are server-only environment secrets.
- Card data is collected by Stripe-hosted interfaces; Gather does not store full card numbers or CVC values.
- Stripe webhook signatures are verified before processing, and financial mutations use idempotency controls.
- Sensitive browser mutations require a same-origin request and are rate limited in Cloudflare D1.
- Organizer MFA is available in the Security Center and is required before privileged-action enforcement is enabled.
- Consequential auction and financial actions are recorded in audit or immutable ledger records.

## Release checklist

1. Run the full automated test suite and production build.
2. Run Supabase Security Advisor and resolve all exposed-table findings.
3. Apply pending migrations in staging, test each role, then apply them in production.
4. Confirm production secrets exist only in encrypted hosting settings and rotate any key that was copied into chat, source, screenshots, or logs.
5. Verify Stripe webhook signatures, retries, failed-event alerts, and reconciliation.
6. Verify security headers on the deployed domain.
7. Confirm backups and perform a documented restore test.
8. Load-test bidding and checkout in staging before a major auction.

## Incident response

If compromise is suspected: pause affected financial actions, preserve logs, rotate the relevant credential, invalidate affected sessions, review audit records, reconcile Stripe independently, notify affected parties when required, and document corrective action before restoring service.

