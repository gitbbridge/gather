# Gather roadmap

This roadmap reflects Gather's documented state and preserves the public-launch priorities in [LAUNCH-READINESS.md](./LAUNCH-READINESS.md). Items marked **Implemented** exist in the current private test application. Items marked **Planned** are future capabilities and must not be represented as available to organizers or bidders.

## Current foundation — Implemented

Gather is a private, mobile-first test application for nonprofit silent auctions. It currently provides:

- Nonprofit splash pages with stable shareable links and anonymous auction browsing.
- Bidder registration at the point of bidding.
- Searchable auction catalogs, item detail and test bidding flows.
- Organizer onboarding, auction administration, nonprofit branding and CSV item reports.
- Watchlists, private maximum bidding, minimum increments, earlier-bid tie handling and anti-sniping extensions.
- Test donations and buy-now reservations. These are commitments only; no money is collected.
- In-app notifications. Email and SMS delivery are not connected.
- A Closeout module for review, participant activity reconciliation, outstanding-action tracking, follow-up draft generation and closeout CSV export.

The application is **not approved for real-money production auctions**. Current payment, donation, purchase and follow-up activity remains clearly labeled as test activity.

## Phase 1 — Required before public launch

These priorities retain the order documented in `LAUNCH-READINESS.md`:

1. Confirm one nonprofit versus a multi-tenant SaaS business, country/currency, nonprofit onboarding, branding and auction rules.
2. Integrate public bidder identity and account recovery using a supported public authentication provider. Add tenant memberships and organizer role management.
3. Connect a payment provider for multi-nonprofit payouts, hosted checkout, verified webhook signatures, idempotent settlement, refunds, receipts, payout reconciliation and failed-payment handling. Never store card details in Gather.
4. Replace the bounded JSON auction aggregate with normalized event, item, bid and order tables and transaction-safe per-item serialization for expected scale.
5. Add durable job scheduling for finalization, winner notification, payment collection, inventory fulfillment and event status transitions.
6. Connect email and SMS providers with consent, deliverability, unsubscribe controls and a transactional outbox.
7. Add donor intake, image upload and moderation, item editing, configurable schedules, reserve prices, shipping and pickup, event tickets, sponsor branding and tax-receipt rules as required by the nonprofit.
8. Add production rate limiting, audit logging, monitoring and alerts, backups and restore drills, privacy and retention controls, an accessibility audit, abuse handling, security review and multi-user concurrency and load testing.
9. Validate end-to-end payment and dispute flows in a sandbox, then complete nonprofit approval and a controlled live launch.

## Phase 2 — Production operations and closeout

**Planned.** Complete the production services needed to turn the existing test Closeout workflow into a reliable operational system:

- Connect collected payments, outstanding balances, refunds and receipts to participant records.
- Add fulfillment workflows for pickup and shipping.
- Send approved transactional winner, payment and fulfillment communications through the production messaging infrastructure.
- Maintain an auditable record of reconciliation and communication actions.
- Add CRM and accounting exports only after the underlying identities, payments and permissions are reliable.

## Phase 3 — Marketing module

**Planned future module. No marketing generation, email delivery, campaign scheduling, social publishing or ad spending is currently implemented.**

The Marketing module will help nonprofit organizers create campaign materials from their existing organization branding, auction information and approved item catalog. It will use Gather's auction data as the source of truth.

### Planned workflow

1. Choose a format: HTML email, Facebook ad creative or social post.
2. Choose what to promote: the entire auction, selected auction items or a Give Holidays travel package.
3. Generate three distinct, finished design previews using the nonprofit's logo, colors, auction photos, dates, approved item descriptions and bidding links.
4. Select a design and edit it in a simple visual designer:
   - Edit text directly.
   - Swap photos.
   - Adjust colors.
   - Request a targeted AI revision while preserving the rest of the approved design.
5. Preview desktop and mobile layouts and approve the final material.
6. Send a test email, send an approved email campaign to an imported donor list or download social and ad creative.

### First milestone

**Planned.** Deliver three editable HTML email designs for a selected auction or item, desktop and mobile previews, explicit organizer approval and test-email sending.

This milestone does not include donor-list import, production campaign sending, campaign scheduling, social publishing or paid-ad placement.

### Later milestones

- Donor-list import, field mapping, deduplication and unsubscribe handling.
- Approved email campaign sending and scheduling.
- Delivery, bounce and click reporting.
- Facebook ad creative and social-post generation with downloadable assets.

Generating Facebook ad creative will create downloadable creative only. It will not publish an advertisement or authorize ad spending.

### Content and approval requirements

- Use existing organization, auction and item data as the source of truth.
- Never invent package inclusions, restrictions, prices, dates or nonprofit claims.
- Flag missing information and require organizer input before affected material can be approved.
- Preserve approved content outside the organizer's requested edit, including during targeted AI revisions.
- Keep revision history and make the exact final content reviewable before approval.
- Require explicit organizer approval before sending or scheduling any campaign.
- Keep test sends visibly separate from approved campaign sends.
- Maintain strict separation between each nonprofit's contacts, campaigns, generated assets and reporting.
- Apply contact permissions, unsubscribe and suppression rules to every eligible campaign recipient.

### Dependencies

- Organization branding, including a verified logo and colors, plus reliable auction and item data.
- AI provider configuration, usage controls and generation-cost monitoring.
- HTML email rendering across major clients and a constrained visual editor that preserves valid, accessible email markup.
- An email delivery provider, sender-domain verification, contact permissions and unsubscribe and suppression handling.
- Organizer authorization, approval records and tenant isolation for contacts and campaigns.
- Production image storage, moderation and rights confirmation.
- The Phase 1 identity, data normalization, messaging, audit, privacy and security foundations.

Campaign sending and scheduling must remain unavailable until the relevant Phase 1 email, consent, security and tenant-isolation requirements are complete. Design generation and test-email work may be developed earlier behind test-only controls, but it does not change Gather's public-launch priorities.

## Future evaluation

After the launch and Marketing phases are stable, evaluate integrations for CRM systems, donor platforms, accounting tools and external ad platforms. Each integration requires a separate data-access, authorization, privacy and operational review before it is added to the committed roadmap.
