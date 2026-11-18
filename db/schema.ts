// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
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

// D1 is the authoritative store for the current auction state. Audit events
// are deliberately separate from that mutable state so corrections can be
// added without rewriting the original history.
export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id'),
  auctionId: text('auction_id').references(() => auctions.id),
  recordType: text('record_type').notNull(),
  recordId: text('record_id').notNull(),
  action: text('action').notNull(),
  actorId: text('actor_id').notNull(),
  actorRole: text('actor_role').notNull(),
  previousState: text('previous_state'),
  newState: text('new_state'),
  reason: text('reason'),
  authorizationReference: text('authorization_reference'),
  sourceSystem: text('source_system').notNull().default('gather_d1'),
  correlationId: text('correlation_id').notNull(),
  previousIntegrityHash: text('previous_integrity_hash'),
  integrityHash: text('integrity_hash').notNull(),
  createdAt: integer('created_at').notNull(),
}, t => [
  index('idx_audit_events_auction_time').on(t.auctionId, t.createdAt),
  index('idx_audit_events_organization_time').on(t.organizationId, t.createdAt),
  index('idx_audit_events_record').on(t.recordType, t.recordId, t.createdAt),
  index('idx_audit_events_correlation').on(t.correlationId),
]);

export const securityRateLimits = sqliteTable('security_rate_limits', {
  key: text('key').primaryKey(),
  requestCount: integer('request_count').notNull(),
  resetAt: integer('reset_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t => [index('idx_security_rate_limits_reset').on(t.resetAt)]);

export const sandboxIssues = sqliteTable('sandbox_issues', {
  id: text('id').primaryKey(),
  fingerprint: text('fingerprint').notNull().unique(),
  createdBy: text('created_by').notNull(),
  title: text('title').notNull(),
  userRole: text('user_role').notNull(),
  workflowArea: text('workflow_area').notNull(),
  issueType: text('issue_type').notNull(),
  priority: text('priority').notNull(),
  description: text('description').notNull(),
  expectedBehavior: text('expected_behavior').notNull(),
  actualBehavior: text('actual_behavior').notNull(),
  pageUrl: text('page_url').notNull(),
  status: text('status').notNull().default('Open'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t => [
  index('idx_sandbox_issues_status_time').on(t.status, t.createdAt),
  index('idx_sandbox_issues_role').on(t.userRole),
  index('idx_sandbox_issues_priority').on(t.priority),
]);

export const plannerModules = sqliteTable('planner_modules', {
  id: text('id').primaryKey(),
  moduleCode: text('module_code').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  purpose: text('purpose').notNull().default(''),
  functionalRequirements: text('functional_requirements').notNull().default(''),
  acceptanceCriteria: text('acceptance_criteria').notNull().default(''),
  status: text('status').notNull().default('Planned'),
  priority: text('priority').notNull().default('Medium'),
  ownerId: text('owner_id'),
  ownerName: text('owner_name').notNull().default('Unassigned'),
  targetRelease: text('target_release'),
  riskLevel: text('risk_level').notNull().default('Medium'),
  progress: integer('progress').notNull().default(0),
  approvalState: text('approval_state').notNull().default('Draft'),
  approvedSnapshot: text('approved_snapshot'),
  archivedAt: integer('archived_at'),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t => [
  uniqueIndex('planner_modules_code_unique').on(t.moduleCode),
  index('idx_planner_modules_status').on(t.status, t.updatedAt),
  index('idx_planner_modules_approval').on(t.approvalState),
]);

export const plannerFeatures = sqliteTable('planner_features', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => plannerModules.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  functionalSpecification: text('functional_specification').notNull().default(''),
  acceptanceCriteria: text('acceptance_criteria').notNull().default(''),
  status: text('status').notNull().default('Planned'),
  approvalState: text('approval_state').notNull().default('Draft'),
  archivedAt: integer('archived_at'),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t => [
  index('idx_planner_features_module').on(t.moduleId, t.updatedAt),
  index('idx_planner_features_approval').on(t.approvalState),
]);

export const plannerComments = sqliteTable('planner_comments', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => plannerModules.id),
  authorId: text('author_id').notNull(),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  editedAt: integer('edited_at'),
  removedAt: integer('removed_at'),
  createdAt: integer('created_at').notNull(),
}, t => [index('idx_planner_comments_module').on(t.moduleId, t.createdAt)]);

export const plannerChangeProposals = sqliteTable('planner_change_proposals', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => plannerModules.id),
  featureId: text('feature_id').references(() => plannerFeatures.id),
  proposalType: text('proposal_type').notNull(),
  fieldName: text('field_name'),
  previousValue: text('previous_value'),
  proposedValue: text('proposed_value'),
  reason: text('reason').notNull().default(''),
  status: text('status').notNull().default('Pending'),
  createdBy: text('created_by').notNull(),
  createdByName: text('created_by_name').notNull(),
  reviewedBy: text('reviewed_by'),
  reviewedByName: text('reviewed_by_name'),
  reviewedAt: integer('reviewed_at'),
  createdAt: integer('created_at').notNull(),
}, t => [
  index('idx_planner_proposals_module').on(t.moduleId, t.createdAt),
  index('idx_planner_proposals_status').on(t.status),
]);

export const plannerDependencies = sqliteTable('planner_dependencies', {
  moduleId: text('module_id').notNull().references(() => plannerModules.id),
  dependsOnModuleId: text('depends_on_module_id').notNull().references(() => plannerModules.id),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
}, t => [
  primaryKey({ columns: [t.moduleId, t.dependsOnModuleId] }),
  index('idx_planner_dependencies_target').on(t.dependsOnModuleId),
]);

export const plannerAuditEvents = sqliteTable('planner_audit_events', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => plannerModules.id),
  featureId: text('feature_id').references(() => plannerFeatures.id),
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name').notNull(),
  action: text('action').notNull(),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
}, t => [
  index('idx_planner_audit_module').on(t.moduleId, t.createdAt),
  index('idx_planner_audit_action').on(t.action, t.createdAt),
]);

export const plannerProjectGoals = sqliteTable('planner_project_goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  approvedScope: text('approved_scope').notNull().default('[]'),
  completionCriteria: text('completion_criteria').notNull().default('[]'),
  targetMilestones: text('target_milestones').notNull().default('[]'),
  baselineVersion: integer('baseline_version').notNull().default(1),
  approvalState: text('approval_state').notNull().default('Draft'),
  approvedAt: integer('approved_at'),
  overallCompletion: integer('overall_completion'),
  lastAssessmentAt: integer('last_assessment_at'),
  scoringVersion: text('scoring_version').notNull().default('gather-evidence-v1'),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const plannerTasks = sqliteTable('planner_tasks', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull().references(() => plannerProjectGoals.id),
  moduleId: text('module_id').notNull().references(() => plannerModules.id),
  name: text('name').notNull(),
  weight: integer('weight').notNull(),
  stage: text('stage').notNull().default('Not started'),
  requirementsEvidence: text('requirements_evidence'),
  implementationEvidence: text('implementation_evidence'),
  testsEvidence: text('tests_evidence'),
  sandboxEvidence: text('sandbox_evidence'),
  productionEvidence: text('production_evidence'),
  blocker: text('blocker'),
  baselineVersion: integer('baseline_version').notNull().default(1),
  baselineIncluded: integer('baseline_included', { mode: 'boolean' }).notNull().default(false),
  weightApproved: integer('weight_approved', { mode: 'boolean' }).notNull().default(false),
  weightApprovedAt: integer('weight_approved_at'),
  weightApprovedBy: text('weight_approved_by'),
  updatedAt: integer('updated_at').notNull(),
}, t => [
  index('idx_planner_tasks_goal').on(t.goalId),
  index('idx_planner_tasks_module').on(t.moduleId),
]);

export const plannerProgressSnapshots = sqliteTable('planner_progress_snapshots', {
  id: text('id').primaryKey(),
  goalId: text('goal_id').notNull().references(() => plannerProjectGoals.id),
  previousPercentage: integer('previous_percentage').notNull(),
  newPercentage: integer('new_percentage').notNull(),
  totalPoints: integer('total_points').notNull(),
  verifiedPoints: integer('verified_points').notNull(),
  evidenceReviewed: text('evidence_reviewed').notNull().default('[]'),
  tasksChanged: text('tasks_changed').notNull().default('[]'),
  scoringVersion: text('scoring_version').notNull(),
  baselineVersion: integer('baseline_version').notNull(),
  initiatedBy: text('initiated_by').notNull(),
  moduleScores: text('module_scores').notNull().default('[]'),
  readinessSummary: text('readiness_summary').notNull().default('{}'),
  blockers: text('blockers').notNull().default('[]'),
  githubChanges: text('github_changes').notNull().default('[]'),
  assessmentFindings: text('assessment_findings').notNull().default('[]'),
  configurationSnapshot: text('configuration_snapshot').notNull().default('{}'),
  createdAt: integer('created_at').notNull(),
}, t => [index('idx_planner_snapshots_goal').on(t.goalId, t.createdAt)]);

export const plannerGithubConnections = sqliteTable('planner_github_connections', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  repository: text('repository').notNull(),
  repositoryUrl: text('repository_url').notNull(),
  trackedBranch: text('tracked_branch').notNull().default('main'),
  authMode: text('auth_mode').notNull().default('public_read_only'),
  status: text('status').notNull().default('Not synchronized'),
  latestSha: text('latest_sha'),
  latestMessage: text('latest_message'),
  latestAuthor: text('latest_author'),
  latestCommitAt: integer('latest_commit_at'),
  openPullRequests: integer('open_pull_requests').notNull().default(0),
  lastSyncedAt: integer('last_synced_at'),
  lastError: text('last_error'),
  rateLimitRemaining: integer('rate_limit_remaining'),
  syncStartedAt: integer('sync_started_at'),
  updatedBy: text('updated_by').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, t => [uniqueIndex('planner_github_repository_unique').on(t.owner, t.repository)]);

export const plannerGithubActivities = sqliteTable('planner_github_activities', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').notNull().references(() => plannerGithubConnections.id),
  eventType: text('event_type').notNull(),
  externalId: text('external_id').notNull(),
  sha: text('sha'),
  title: text('title').notNull(),
  author: text('author').notNull().default('Unknown'),
  url: text('url').notNull(),
  occurredAt: integer('occurred_at').notNull(),
  changedFiles: text('changed_files').notNull().default('[]'),
  pullRequestNumber: integer('pull_request_number'),
  matchedModuleId: text('matched_module_id').references(() => plannerModules.id),
  matchMethod: text('match_method'),
  reviewState: text('review_state').notNull().default('Unreviewed'),
  syncedAt: integer('synced_at').notNull(),
}, t => [
  uniqueIndex('planner_github_activity_external_unique').on(t.connectionId, t.eventType, t.externalId),
  index('idx_planner_github_activity_module').on(t.matchedModuleId, t.occurredAt),
  index('idx_planner_github_activity_time').on(t.occurredAt),
]);

export const plannerCodeLinks = sqliteTable('planner_code_links', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => plannerModules.id),
  linkType: text('link_type').notNull(),
  label: text('label').notNull(),
  reference: text('reference').notNull(),
  url: text('url').notNull(),
  source: text('source').notNull().default('administrator'),
  reviewState: text('review_state').notNull().default('Confirmed'),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  archivedAt: integer('archived_at'),
}, t => [
  index('idx_planner_code_links_module').on(t.moduleId, t.updatedAt),
  uniqueIndex('planner_code_link_unique').on(t.moduleId, t.linkType, t.reference),
]);
