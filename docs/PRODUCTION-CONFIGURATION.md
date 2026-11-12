# Gather production configuration checklist

This checklist verifies production configuration without displaying or committing secret values. It does not deploy, mutate provider settings, or replace provider-side review.

## Automated manifest check

Load the production environment in a secure local shell or hosting validation job, then run:

```bash
npm run production:validate
```

Before authorizing real-money launch, run the stricter gate:

```bash
npm run production:validate:launch
```

The launch gate requires the production origin, separate production Supabase and D1 resources, matching Stripe live-mode keys, a webhook signing secret, live email delivery, the verified Gather sender, privileged MFA, no sandbox demo password or test sink, and unpublished draft legal pages. It reports variable names and corrective actions but never credential values.

## Provider-side checks that remain manual

Record the date and reviewer for each check. Do not paste secret values into this file.

- **ChatGPT Sites:** the existing production project is attached to `gatherforgood.bid`; its environment references the production Supabase and D1 resources, not sandbox resources.
- **Supabase Auth:** Site URL is `https://gatherforgood.bid`; allowed redirect URLs include `https://gatherforgood.bid/auth/callback`; email confirmation and password recovery return to the production domain; privileged users have MFA enrolled.
- **Stripe:** the production Connect platform is in live mode; `https://gatherforgood.bid/api/stripe/webhook` is an enabled live endpoint; its signing secret matches the production environment; required checkout, payment, refund, and account events are selected.
- **Resend:** `gatherforgood.bid` is verified; SPF, DKIM, and DMARC pass; `noreply@gatherforgood.bid` is authorized; test-sink delivery and temporary BCC monitoring are disabled before customer launch.
- **D1:** the production Sites project alone has the production `DB` binding; the sandbox project has a different database ID; production migrations match the reviewed source commit.
- **Smoke verification:** signup, confirmation, password reset, organizer sign-in, bidder sign-in, a test-mode rehearsal, and final live-mode webhook health are recorded without exposing personal data.

## Promotion evidence

Before deployment, retain the exact source commit, production build result, targeted payment/auth test results, the completed provider checklist, and explicit deployment authorization. After deployment, record the Sites version and verify `/`, `/about/give-holidays`, `/auth`, and webhook health on the live domain.
