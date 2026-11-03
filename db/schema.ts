// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const nonprofits = sqliteTable('nonprofits', {
  id: text('id').primaryKey(), owner: text('owner').notNull(),
  slug: text('slug').notNull().unique(), name: text('name').notNull(),
  headline: text('headline').notNull(), mission: text('mission').notNull(),
  accent: text('accent').notNull().default('#175b47'),
}, t => [index('idx_nonprofits_owner').on(t.owner)]);
export const nonprofitHomepages = sqliteTable('nonprofit_homepages', {
  nonprofitId: text('nonprofit_id').primaryKey().references(()=>nonprofits.id),
  draft: text('draft').notNull(),
  published: text('published'),
  draftVersion: integer('draft_version').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
  publishedAt: integer('published_at'),
}, t => [index('idx_homepages_updated').on(t.updatedAt)]);
export const registrations = sqliteTable('registrations', {
  nonprofitId: text('nonprofit_id').notNull().references(()=>nonprofits.id),
  userId: text('user_id').notNull(), name: text('name').notNull(),
  email: text('email').notNull(), createdAt: integer('created_at').notNull(),
}, t => [primaryKey({columns:[t.nonprofitId,t.userId]})]);
export const auctions = sqliteTable('auctions', {
  id: text('id').primaryKey(), owner: text('owner').notNull(),
  state: text('state').notNull(), version: integer('version').notNull().default(0),
  nonprofitId: text('nonprofit_id').references(()=>nonprofits.id),
}, t => [index('idx_auctions_owner').on(t.owner),index('idx_auctions_nonprofit').on(t.nonprofitId)]);
export const closeoutRecords = sqliteTable('closeout_records', {
  auctionId: text('auction_id').notNull().references(()=>auctions.id),
  userId: text('user_id').notNull(),
  pickupStatus: text('pickup_status').notNull().default('pending'),
  followupStatus: text('followup_status').notNull().default('not_sent'),
  updatedAt: integer('updated_at').notNull(),
}, t => [primaryKey({columns:[t.auctionId,t.userId]}),index('idx_closeout_auction').on(t.auctionId)]);

export const stripeWebhookEvents = sqliteTable('stripe_webhook_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  objectId: text('object_id'),
  accountId: text('account_id'),
  livemode: integer('livemode', { mode: 'boolean' }).notNull(),
  status: text('status').notNull().default('accepted'),
  stripeCreatedAt: integer('stripe_created_at').notNull(),
  receivedAt: integer('received_at').notNull(),
  processedAt: integer('processed_at'),
  lastError: text('last_error'),
}, t => [
  index('idx_stripe_events_status').on(t.status),
  index('idx_stripe_events_created').on(t.stripeCreatedAt),
]);

export const nonprofitPaymentAccounts = sqliteTable('nonprofit_payment_accounts', {
  nonprofitId: text('nonprofit_id').primaryKey().references(()=>nonprofits.id),
  stripeAccountId: text('stripe_account_id').notNull().unique(),
  status: text('status').notNull().default('pending'),
  cardPaymentsStatus: text('card_payments_status').notNull().default('pending'),
  payoutsStatus: text('payouts_status').notNull().default('pending'),
  livemode: integer('livemode', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at').notNull(),
}, t => [index('idx_payment_accounts_status').on(t.status)]);
