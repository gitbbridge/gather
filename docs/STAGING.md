# Gather sandbox setup

The Gather sandbox uses the same source repository as production but separate hosting, Supabase, D1, Stripe, and email configuration. Production resources must never be substituted when a staging resource is missing.

## Safety behavior already implemented

- `GATHER_ENVIRONMENT=staging` enables the global TEST MODE banner and `/testing`.
- The application refuses to start in staging when its URL, Supabase project, D1 identifier, Stripe mode, email sink, or tester allowlist is missing or unsafe.
- Staging rejects Stripe live secret keys and live-mode webhook events.
- Application email recipients are replaced with `TEST_EMAIL_RECIPIENT`, BCC is disabled, and subjects receive `[GATHER TEST]`.
- `/testing` and `/api/testing/issues` require a normal signed-in Supabase user listed in `SANDBOX_TESTER_EMAILS`.
- `/testing` returns 404 in production and the TEST MODE banner is not rendered there.
- Issue records are stored only through the sandbox D1 binding. Repeated identical submissions return the existing record.

## External resources the owner must create

These are independent resources and cannot be safely inferred or created with production credentials.

1. **Supabase:** create a new project named `Gather Sandbox`. Record its project ref, URL, publishable key, and secret key. Configure `https://sandbox.gatherforgood.bid/auth/callback` and `https://sandbox.gatherforgood.bid/auth/update-password` as allowed redirects. Configure its own SMTP credentials and branded templates. Do not import production users.
2. **Cloudflare D1:** create a database named `gather-sandbox`. Bind that database as `DB` only on the staging hosting destination. Apply the existing migrations, including the `sandbox_issues` migration. Do not bind the production D1 database.
3. **Stripe:** use test-mode publishable and secret keys. Create a test webhook for `https://sandbox.gatherforgood.bid/api/stripe/webhook` and store its signing secret. Never use a key beginning `sk_live_` or `pk_live_`.
4. **Email:** create a staging-only Resend API key. Use an owner-controlled recipient as `TEST_EMAIL_RECIPIENT`. Configure staging Supabase Auth SMTP separately and ensure all six test identities resolve to inboxes controlled by the owner.
5. **Hosting:** create or select a separate staging Sites/Cloudflare hosting project from this repository. Configure the variables from `.env.staging.example`, bind the staging D1 database, and attach `sandbox.gatherforgood.bid`. Do not change the existing production Sites project.
6. **DNS:** after the staging host supplies its target and validation records, add only the `sandbox` record it specifies. Do not edit the apex or `www` records.

## Configuration validation

Copy `.env.staging.example` to an untracked local environment file and replace placeholders with staging values. Then run:

```bash
node --env-file=.env.staging.local scripts/validate-staging-config.mjs
```

The validator reports only key names and safety failures; it never prints credential values.

## Test accounts

Create these six identities through normal staging Supabase Auth. Use unique owner-controlled inbox aliases and unique passwords. Do not hardcode passwords in source or seed files.

| Account | Staging configuration |
| --- | --- |
| Nonprofit organizer | `profiles.account_type = organizer` |
| Bidder 1 | Standard bidder account |
| Bidder 2 | Standard bidder account |
| Bidder 3 | Standard bidder account |
| Gather administrator | Add email to `PLATFORM_ADMIN_EMAILS`; enroll MFA |
| Give Holidays manager | Add email to `PLATFORM_ADMIN_EMAILS`; enroll MFA |

Add the owner and the test identities that may use the testing center to `SANDBOX_TESTER_EMAILS`. This allowlist does not change their application role.

## Minimal fixture data

After Supabase users and staging D1 exist, create fixtures through the normal staging UI:

1. Sign in as the organizer and complete onboarding for one fictional nonprofit and one auction.
2. Add two fictional donated items.
3. Sign in as the Give Holidays manager and add one clearly labeled test travel package.
4. Add the travel package to the test auction.
5. Register the three bidder accounts normally.

Do not run winner checkout, send customer messages, or move travel fulfillment beyond a clearly marked test record during setup.

## Release checklist

- Run `staging:validate` with the staging environment loaded.
- Confirm `/testing` redirects signed-out users to normal authentication.
- Confirm an unlisted signed-in user receives no testing-center access.
- Confirm a listed tester can create, filter, and update one issue.
- Confirm application email reaches only the configured sink.
- Send one Stripe test event and confirm a live-mode event is rejected.
- Confirm production `/testing` is 404 and production has no TEST MODE banner.

No production deployment, database migration, DNS change, or Git push is part of this setup document.
