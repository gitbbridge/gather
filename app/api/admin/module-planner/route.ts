import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import {
  calculateProjectProgress,
  MODULE_PRIORITIES,
  MODULE_STATUSES,
  PROGRESS_STAGES,
  RISK_LEVELS,
  TASK_WEIGHTS,
  wouldCreateDependencyCycle,
  type ProgressStage,
} from "@/lib/module-planner";
import {
  GATHER_GITHUB_OWNER,
  GATHER_GITHUB_REPOSITORY,
  GATHER_GITHUB_URL,
  GithubSyncError,
  githubReferenceUrl,
  synchronizeGatherGithub,
} from "@/lib/module-planner-github";
import { database } from "@/lib/nonprofits";
import { isPlatformAdmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store" },
});

const statuses = [...MODULE_STATUSES] as [string, ...string[]];
const priorities = [...MODULE_PRIORITIES] as [string, ...string[]];
const risks = [...RISK_LEVELS] as [string, ...string[]];
const stages = Object.keys(PROGRESS_STAGES) as [ProgressStage, ...ProgressStage[]];

const moduleFields = {
  name: "name",
  description: "description",
  purpose: "purpose",
  functionalRequirements: "functional_requirements",
  acceptanceCriteria: "acceptance_criteria",
  status: "status",
  priority: "priority",
  ownerName: "owner_name",
  targetRelease: "target_release",
  riskLevel: "risk_level",
  progress: "progress",
} as const;

const protectedModuleFields = new Set([
  "name", "description", "purpose", "functionalRequirements", "acceptanceCriteria",
]);

const featureFields = {
  name: "name",
  description: "description",
  functionalSpecification: "functional_specification",
  acceptanceCriteria: "acceptance_criteria",
  status: "status",
} as const;

async function adminUser() {
  const user = await getAppUser();
  return user && isPlatformAdmin(user) ? user : null;
}

function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 100_000) throw new Error("Request too large.");
  return JSON.parse(raw) as Record<string, unknown>;
}

async function audit(input: {
  moduleId: string;
  featureId?: string | null;
  actorId: string;
  actorName: string;
  action: string;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}) {
  await database().prepare(`INSERT INTO planner_audit_events (
    id,module_id,feature_id,actor_id,actor_name,action,previous_value,new_value,metadata,created_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(
    randomUUID(), input.moduleId, input.featureId || null, input.actorId, input.actorName,
    input.action,
    input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
    input.newValue === undefined ? null : JSON.stringify(input.newValue),
    input.metadata === undefined ? null : JSON.stringify(input.metadata),
    Date.now(),
  ).run();
}

function buildContradictions(
  modules: Array<Record<string, unknown>>,
  tasks: Array<Record<string, unknown>>,
  activities: Array<Record<string, unknown>>,
  criticalIssues: Array<Record<string, unknown>>,
) {
  const findings: Array<{ moduleId?: string; taskId?: string; type: string; message: string }> = [];
  for (const moduleRecord of modules) {
    const moduleTasks = tasks.filter((task) => task.moduleId === moduleRecord.id);
    if (moduleRecord.status === "Completed" && moduleTasks.some((task) => !String(task.testsEvidence || "").trim()))
      findings.push({ moduleId: String(moduleRecord.id), type: "missing_tests", message: "Module is marked completed, but one or more approved tasks lack test evidence." });
  }
  for (const activity of activities) {
    if (!activity.matchedModuleId || activity.eventType !== "commit") continue;
    const verified = tasks.some((task) => task.moduleId === activity.matchedModuleId && String(task.implementationEvidence || "").includes(String(activity.sha || "")));
    if (!verified) findings.push({ moduleId: String(activity.matchedModuleId), type: "unverified_commit", message: `Linked commit ${String(activity.sha || "").slice(0, 7)} is not recorded as verified implementation evidence.` });
  }
  if (criticalIssues.length) findings.push({ type: "critical_defect", message: `${criticalIssues.length} unresolved critical Testing Center issue(s) require attention.` });
  return findings.slice(0, 30);
}

function buildRecommendations(
  modules: Array<Record<string, unknown>>,
  tasks: Array<Record<string, unknown>>,
  blockers: Array<{ taskId: unknown; moduleId: unknown; text: unknown }>,
  criticalIssues: Array<Record<string, unknown>>,
) {
  const recommendations: Array<{ moduleId?: string; taskId?: string; action: string; reason: string; dependency?: string }> = [];
  if (criticalIssues.length) recommendations.push({ action: "Resolve critical sandbox defects", reason: `${criticalIssues.length} critical Testing Center issue(s) prevent trustworthy release readiness.` });
  for (const blocker of blockers) {
    recommendations.push({ moduleId: String(blocker.moduleId), taskId: String(blocker.taskId), action: "Resolve documented blocker", reason: String(blocker.text) });
  }
  for (const task of tasks) {
    if (recommendations.length >= 3) break;
    const moduleRecord = modules.find((item) => item.id === task.moduleId);
    const next = !String(task.implementationEvidence || "").trim() ? "Complete and inspect implementation" : !String(task.testsEvidence || "").trim() ? "Run and record targeted tests" : !String(task.sandboxEvidence || "").trim() ? "Verify in the Gather sandbox" : !String(task.productionEvidence || "").trim() ? "Prepare production verification after deployment approval" : null;
    if (next) recommendations.push({ moduleId: String(task.moduleId), taskId: String(task.id), action: next, reason: `${String(moduleRecord?.moduleCode || "Module")} · ${String(task.name)}` });
  }
  return recommendations.slice(0, 3);
}

async function plannerState() {
  const db = database();
  const [modules, features, comments, proposals, dependencies, events, goals, tasks, snapshots, issues, githubConnections, githubActivities, codeLinks] = await Promise.all([
    db.prepare(`SELECT id,module_code AS moduleCode,name,description,purpose,functional_requirements AS functionalRequirements,acceptance_criteria AS acceptanceCriteria,status,priority,owner_id AS ownerId,owner_name AS ownerName,target_release AS targetRelease,risk_level AS riskLevel,progress,approval_state AS approvalState,approved_snapshot AS approvedSnapshot,archived_at AS archivedAt,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM planner_modules ORDER BY updated_at DESC`).all(),
    db.prepare(`SELECT id,module_id AS moduleId,name,description,functional_specification AS functionalSpecification,acceptance_criteria AS acceptanceCriteria,status,approval_state AS approvalState,archived_at AS archivedAt,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM planner_features ORDER BY created_at`).all(),
    db.prepare(`SELECT id,module_id AS moduleId,author_id AS authorId,author_name AS authorName,body,edited_at AS editedAt,removed_at AS removedAt,created_at AS createdAt FROM planner_comments ORDER BY created_at`).all(),
    db.prepare(`SELECT id,module_id AS moduleId,feature_id AS featureId,proposal_type AS proposalType,field_name AS fieldName,previous_value AS previousValue,proposed_value AS proposedValue,reason,status,created_by AS createdBy,created_by_name AS createdByName,reviewed_by AS reviewedBy,reviewed_by_name AS reviewedByName,reviewed_at AS reviewedAt,created_at AS createdAt FROM planner_change_proposals ORDER BY created_at DESC`).all(),
    db.prepare(`SELECT module_id AS moduleId,depends_on_module_id AS dependsOnModuleId,created_by AS createdBy,created_at AS createdAt FROM planner_dependencies`).all(),
    db.prepare(`SELECT id,module_id AS moduleId,feature_id AS featureId,actor_id AS actorId,actor_name AS actorName,action,previous_value AS previousValue,new_value AS newValue,metadata,created_at AS createdAt FROM planner_audit_events ORDER BY created_at DESC LIMIT 1000`).all(),
    db.prepare(`SELECT id,name,description,approved_scope AS approvedScope,completion_criteria AS completionCriteria,target_milestones AS targetMilestones,baseline_version AS baselineVersion,approval_state AS approvalState,approved_at AS approvedAt,overall_completion AS overallCompletion,last_assessment_at AS lastAssessmentAt,scoring_version AS scoringVersion,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM planner_project_goals ORDER BY created_at LIMIT 1`).all(),
    db.prepare(`SELECT id,goal_id AS goalId,module_id AS moduleId,name,weight,stage,requirements_evidence AS requirementsEvidence,implementation_evidence AS implementationEvidence,tests_evidence AS testsEvidence,sandbox_evidence AS sandboxEvidence,production_evidence AS productionEvidence,blocker,baseline_version AS baselineVersion,baseline_included AS baselineIncluded,weight_approved AS weightApproved,weight_approved_at AS weightApprovedAt,weight_approved_by AS weightApprovedBy,updated_at AS updatedAt FROM planner_tasks ORDER BY updated_at DESC`).all(),
    db.prepare(`SELECT id,goal_id AS goalId,previous_percentage AS previousPercentage,new_percentage AS newPercentage,total_points AS totalPoints,verified_points AS verifiedPoints,evidence_reviewed AS evidenceReviewed,tasks_changed AS tasksChanged,scoring_version AS scoringVersion,baseline_version AS baselineVersion,initiated_by AS initiatedBy,module_scores AS moduleScores,readiness_summary AS readinessSummary,blockers,github_changes AS githubChanges,assessment_findings AS assessmentFindings,configuration_snapshot AS configurationSnapshot,created_at AS createdAt FROM planner_progress_snapshots ORDER BY created_at DESC LIMIT 100`).all(),
    db.prepare(`SELECT id,title,priority,status,page_url AS pageUrl,updated_at AS updatedAt FROM sandbox_issues WHERE status != 'Resolved' ORDER BY updated_at DESC LIMIT 100`).all(),
    db.prepare(`SELECT id,owner,repository,repository_url AS repositoryUrl,tracked_branch AS trackedBranch,auth_mode AS authMode,status,latest_sha AS latestSha,latest_message AS latestMessage,latest_author AS latestAuthor,latest_commit_at AS latestCommitAt,open_pull_requests AS openPullRequests,last_synced_at AS lastSyncedAt,last_error AS lastError,rate_limit_remaining AS rateLimitRemaining,sync_started_at AS syncStartedAt,updated_at AS updatedAt FROM planner_github_connections ORDER BY updated_at DESC LIMIT 1`).all(),
    db.prepare(`SELECT id,connection_id AS connectionId,event_type AS eventType,external_id AS externalId,sha,title,author,url,occurred_at AS occurredAt,changed_files AS changedFiles,pull_request_number AS pullRequestNumber,matched_module_id AS matchedModuleId,match_method AS matchMethod,review_state AS reviewState,synced_at AS syncedAt FROM planner_github_activities ORDER BY occurred_at DESC LIMIT 200`).all(),
    db.prepare(`SELECT id,module_id AS moduleId,link_type AS linkType,label,reference,url,source,review_state AS reviewState,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt,archived_at AS archivedAt FROM planner_code_links ORDER BY updated_at DESC`).all(),
  ]);
  const moduleRows = modules.results as Array<Record<string, unknown>>;
  const taskRows = tasks.results as Array<Record<string, unknown>>;
  const goal = goals.results[0] as Record<string, unknown> | undefined;
  const approvedBaseline = goal?.approvalState === "Approved";
  const baselineTasks = taskRows.filter((task) => approvedBaseline && Boolean(task.baselineIncluded) && Boolean(task.weightApproved) && Number(task.baselineVersion) === Number(goal?.baselineVersion));
  const score = calculateProjectProgress(baselineTasks.map((task) => ({
    id: String(task.id), weight: Number(task.weight), stage: task.stage as ProgressStage,
    requirementsEvidence: task.requirementsEvidence as string | null,
    implementationEvidence: task.implementationEvidence as string | null,
    testsEvidence: task.testsEvidence as string | null,
    sandboxEvidence: task.sandboxEvidence as string | null,
    productionEvidence: task.productionEvidence as string | null,
  })));
  const activeModules = moduleRows.filter((module) => !module.archivedAt);
  const includedModuleIds = new Set(baselineTasks.map((task) => String(task.moduleId)));
  const moduleProgress = [...includedModuleIds].map((moduleId) => {
    const moduleTasks = baselineTasks.filter((task) => task.moduleId === moduleId);
    return { moduleId, ...calculateProjectProgress(moduleTasks.map((task) => ({
      id: String(task.id), weight: Number(task.weight), stage: task.stage as ProgressStage,
      requirementsEvidence: task.requirementsEvidence as string | null,
      implementationEvidence: task.implementationEvidence as string | null,
      testsEvidence: task.testsEvidence as string | null,
      sandboxEvidence: task.sandboxEvidence as string | null,
      productionEvidence: task.productionEvidence as string | null,
    }))) };
  });
  const criticalIssues = (issues.results as Array<Record<string, unknown>>).filter((issue) => issue.priority === "Critical");
  const blockers = baselineTasks.filter((task) => String(task.blocker || "").trim()).map((task) => ({ taskId: task.id, moduleId: task.moduleId, text: task.blocker }));
  const configured = approvedBaseline && baselineTasks.length > 0 && baselineTasks.every((task) => Number(task.weight) > 0);
  const readiness = configured ? {
    sandbox: Math.round((baselineTasks.filter((task) => String(task.sandboxEvidence || "").trim()).length / baselineTasks.length) * 100),
    production: Math.round((baselineTasks.filter((task) => String(task.productionEvidence || "").trim()).length / baselineTasks.length) * 100),
    complete: true,
  } : { sandbox: null, production: null, complete: false };
  const contradictions = buildContradictions(moduleRows, baselineTasks, githubActivities.results as Array<Record<string, unknown>>, criticalIssues);
  const recommendations = buildRecommendations(moduleRows, baselineTasks, blockers, criticalIssues);
  return {
    modules: moduleRows,
    features: features.results,
    comments: comments.results,
    proposals: proposals.results,
    dependencies: dependencies.results,
    auditEvents: events.results,
    projectGoal: goals.results[0] || null,
    tasks: taskRows,
    snapshots: snapshots.results,
    sandboxIssues: issues.results,
    githubConnection: githubConnections.results[0] || null,
    githubActivities: githubActivities.results,
    codeLinks: codeLinks.results,
    analyzer: {
      ...(configured ? score : { percentage: null, totalPoints: 0, verifiedPoints: 0 }),
      configured,
      remainingPoints: configured ? Math.max(0, score.totalPoints - score.verifiedPoints) : null,
      moduleProgress,
      readiness,
      contradictions,
      recommendations,
      blockers,
      outstandingCriticalBugs: criticalIssues.length,
      aiAvailable: false,
      scoringVersion: "gather-evidence-v1",
    },
    metrics: {
      total: activeModules.length,
      inProgress: activeModules.filter((module) => module.status === "In progress").length,
      needsReview: activeModules.filter((module) => module.status === "Needs review").length,
      recentlyUpdated: activeModules.filter((module) => Number(module.updatedAt) >= Date.now() - 7 * 86400000).length,
    },
  };
}

export async function GET() {
  const user = await adminUser();
  if (!user) return json({ error: "Platform administrator access required." }, 403);
  try {
    return json(await plannerState());
  } catch (error) {
    console.error("Unable to load Module Planner:", error);
    return json({ error: "Module Planner database migration is required." }, 503);
  }
}

const createModule = z.object({
  moduleCode: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9-]+$/).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(50_000).default(""),
  purpose: z.string().trim().max(50_000).default(""),
  functionalRequirements: z.string().trim().max(100_000).default(""),
  acceptanceCriteria: z.string().trim().max(100_000).default(""),
  status: z.enum(statuses).default("Planned"),
  priority: z.enum(priorities).default("Medium"),
  ownerName: z.string().trim().max(160).default("Unassigned"),
  targetRelease: z.string().trim().max(120).nullable().optional(),
  riskLevel: z.enum(risks).default("Medium"),
});

const createFeature = z.object({
  moduleId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(50_000).default(""),
  functionalSpecification: z.string().trim().max(100_000).default(""),
  acceptanceCriteria: z.string().trim().max(100_000).default(""),
  status: z.enum(statuses).default("Planned"),
});

const updateModule = z.object({
  moduleId: z.string().uuid(),
  changes: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

const updateFeature = z.object({
  featureId: z.string().uuid(),
  changes: z.record(z.string(), z.union([z.string(), z.null()])),
});

export async function POST(request: Request) {
  const user = await adminUser();
  if (!user) return json({ error: "Platform administrator access required." }, 403);
  if (!sameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  let input: Record<string, unknown>;
  try { input = await body(request); } catch { return json({ error: "Invalid request." }, 400); }
  const action = String(input.action || "");
  const db = database();
  const now = Date.now();

  try {
    if (action === "github.sync") {
      const branch = z.string().trim().min(1).max(200).default("main").safeParse(input.trackedBranch || "main");
      if (!branch.success) return json({ error: "Enter a valid tracked branch." }, 400);
      const connectionId = "gather-github";
      await db.prepare(`INSERT OR IGNORE INTO planner_github_connections (id,owner,repository,repository_url,tracked_branch,auth_mode,status,updated_by,updated_at) VALUES (?,?,?,?,?,'public_read_only','Not synchronized',?,?)`).bind(
        connectionId, GATHER_GITHUB_OWNER, GATHER_GITHUB_REPOSITORY, GATHER_GITHUB_URL, branch.data, user.userId, now,
      ).run();
      const connection = await db.prepare("SELECT sync_started_at AS syncStartedAt FROM planner_github_connections WHERE id=?").bind(connectionId).first<{ syncStartedAt?: number | null }>();
      if (connection?.syncStartedAt && connection.syncStartedAt > now - 120_000) return json({ error: "GitHub synchronization is already running." }, 409);
      await db.prepare("UPDATE planner_github_connections SET sync_started_at=?,status='Synchronizing',last_error=NULL,updated_by=?,updated_at=? WHERE id=?").bind(now, user.userId, now, connectionId).run();
      try {
        const moduleResult = await db.prepare("SELECT id,module_code AS moduleCode FROM planner_modules WHERE archived_at IS NULL").all<{ id: string; moduleCode: string }>();
        const synchronized = await synchronizeGatherGithub(branch.data, moduleResult.results);
        for (const activity of synchronized.activities) {
          await db.prepare(`INSERT INTO planner_github_activities (id,connection_id,event_type,external_id,sha,title,author,url,occurred_at,changed_files,pull_request_number,matched_module_id,match_method,review_state,synced_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(connection_id,event_type,external_id) DO UPDATE SET sha=excluded.sha,title=excluded.title,author=excluded.author,url=excluded.url,occurred_at=excluded.occurred_at,changed_files=excluded.changed_files,pull_request_number=excluded.pull_request_number,matched_module_id=CASE WHEN planner_github_activities.review_state IN ('Confirmed','Rejected') THEN planner_github_activities.matched_module_id ELSE excluded.matched_module_id END,match_method=CASE WHEN planner_github_activities.review_state IN ('Confirmed','Rejected') THEN planner_github_activities.match_method ELSE excluded.match_method END,review_state=CASE WHEN planner_github_activities.review_state IN ('Confirmed','Rejected') THEN planner_github_activities.review_state ELSE excluded.review_state END,synced_at=excluded.synced_at`).bind(
            randomUUID(), connectionId, activity.eventType, activity.externalId, activity.sha || null, activity.title, activity.author,
            activity.url, activity.occurredAt, JSON.stringify(activity.changedFiles), activity.pullRequestNumber || null,
            activity.matchedModuleId || null, activity.matchMethod || null, activity.matchedModuleId ? "Suggested" : "Unreviewed", now,
          ).run();
        }
        const latest = synchronized.latest;
        await db.prepare(`UPDATE planner_github_connections SET tracked_branch=?,repository_url=?,auth_mode=?,status='Connected',latest_sha=?,latest_message=?,latest_author=?,latest_commit_at=?,open_pull_requests=?,last_synced_at=?,last_error=NULL,rate_limit_remaining=?,sync_started_at=NULL,updated_by=?,updated_at=? WHERE id=?`).bind(
          synchronized.trackedBranch, synchronized.repositoryUrl, synchronized.authMode, latest?.sha || null,
          latest?.commit.message.split("\n")[0] || null, latest?.author?.login || latest?.commit.author?.name || null,
          latest?.commit.author?.date ? Date.parse(latest.commit.author.date) : null, synchronized.openPullRequests,
          now, synchronized.rateLimitRemaining, user.userId, now, connectionId,
        ).run();
        return json({ synchronized: true, activities: synchronized.activities.length, lastSyncedAt: now });
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : "GitHub synchronization failed.";
        const remaining = syncError instanceof GithubSyncError ? syncError.rateLimitRemaining : null;
        await db.prepare("UPDATE planner_github_connections SET status='Error',last_error=?,rate_limit_remaining=?,sync_started_at=NULL,updated_by=?,updated_at=? WHERE id=?").bind(message, remaining, user.userId, now, connectionId).run();
        return json({ error: message }, syncError instanceof GithubSyncError && syncError.status === 404 ? 404 : 502);
      }
    }

    if (action === "github.activity.review") {
      const parsed = z.object({ activityId: z.string().uuid(), moduleId: z.string().uuid().nullable(), decision: z.enum(["Confirmed", "Rejected"]), reason: z.string().trim().min(3).max(5000) }).safeParse(input);
      if (!parsed.success) return json({ error: "Choose an association decision and record the reason." }, 400);
      const current = await db.prepare("SELECT * FROM planner_github_activities WHERE id=?").bind(parsed.data.activityId).first<Record<string, unknown>>();
      if (!current) return json({ error: "GitHub activity not found." }, 404);
      const moduleId = parsed.data.decision === "Confirmed" ? parsed.data.moduleId : current.matched_module_id;
      if (parsed.data.decision === "Confirmed" && !moduleId) return json({ error: "Select the related module." }, 400);
      await db.prepare("UPDATE planner_github_activities SET matched_module_id=?,match_method='administrator_review',review_state=? WHERE id=?").bind(moduleId || null, parsed.data.decision, parsed.data.activityId).run();
      if (moduleId) await audit({ moduleId: String(moduleId), actorId: user.userId, actorName: user.displayName, action: "github.association.reviewed", previousValue: current, newValue: { decision: parsed.data.decision, reason: parsed.data.reason } });
      return json({ reviewed: true });
    }

    if (action === "codeLink.create") {
      const parsed = z.object({ moduleId: z.string().uuid(), linkType: z.enum(["file", "directory", "commit", "pull_request", "issue", "branch", "release"]), label: z.string().trim().min(2).max(200), reference: z.string().trim().min(1).max(1000) }).safeParse(input);
      if (!parsed.success) return json({ error: "Complete the source-code association." }, 400);
      const url = githubReferenceUrl(parsed.data.linkType, parsed.data.reference);
      if (!url) return json({ error: "That reference is not valid for the selected GitHub link type." }, 400);
      const id = randomUUID();
      await db.prepare(`INSERT INTO planner_code_links (id,module_id,link_type,label,reference,url,source,review_state,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,'administrator','Confirmed',?,?,?)`).bind(
        id, parsed.data.moduleId, parsed.data.linkType, parsed.data.label, parsed.data.reference, url, user.userId, now, now,
      ).run();
      await audit({ moduleId: parsed.data.moduleId, actorId: user.userId, actorName: user.displayName, action: "source.linked", newValue: { id, ...parsed.data, url } });
      return json({ id, url }, 201);
    }

    if (action === "codeLink.archive") {
      const parsed = z.object({ linkId: z.string().uuid(), reason: z.string().trim().min(3).max(5000), restore: z.boolean().default(false) }).safeParse(input);
      if (!parsed.success) return json({ error: "Record a reason for this source-link change." }, 400);
      const current = await db.prepare("SELECT * FROM planner_code_links WHERE id=?").bind(parsed.data.linkId).first<Record<string, unknown>>();
      if (!current) return json({ error: "Source link not found." }, 404);
      await db.prepare("UPDATE planner_code_links SET archived_at=?,updated_at=? WHERE id=?").bind(parsed.data.restore ? null : now, now, parsed.data.linkId).run();
      await audit({ moduleId: String(current.module_id), actorId: user.userId, actorName: user.displayName, action: parsed.data.restore ? "source.link.restored" : "source.link.archived", previousValue: current, newValue: { reason: parsed.data.reason } });
      return json({ updated: true });
    }

    if (action === "module.create") {
      const parsed = createModule.safeParse(input);
      if (!parsed.success) return json({ error: "Complete the required module fields." }, 400);
      const id = randomUUID();
      const value = parsed.data;
      await db.prepare(`INSERT INTO planner_modules (id,module_code,name,description,purpose,functional_requirements,acceptance_criteria,status,priority,owner_id,owner_name,target_release,risk_level,progress,approval_state,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,'Draft',?,?,?)`).bind(
        id, value.moduleCode, value.name, value.description, value.purpose, value.functionalRequirements,
        value.acceptanceCriteria, value.status, value.priority, user.userId, value.ownerName,
        value.targetRelease || null, value.riskLevel, user.userId, now, now,
      ).run();
      await audit({ moduleId: id, actorId: user.userId, actorName: user.displayName, action: "module.created", newValue: value });
      return json({ id }, 201);
    }

    if (action === "module.update") {
      const parsed = updateModule.safeParse(input);
      if (!parsed.success) return json({ error: "Invalid module update." }, 400);
      const current = await db.prepare("SELECT * FROM planner_modules WHERE id=?").bind(parsed.data.moduleId).first<Record<string, unknown>>();
      if (!current) return json({ error: "Module not found." }, 404);
      const entries = Object.entries(parsed.data.changes).filter(([field]) => field in moduleFields);
      if (!entries.length) return json({ error: "No supported changes supplied." }, 400);
      if (current.approval_state === "Approved" && entries.some(([field]) => protectedModuleFields.has(field)))
        return json({ error: "Approved specifications are protected. Submit a proposed change instead." }, 409);
      for (const [field, value] of entries) {
        if (field === "status" && !MODULE_STATUSES.includes(value as typeof MODULE_STATUSES[number])) return json({ error: "Invalid status." }, 400);
        if (field === "priority" && !MODULE_PRIORITIES.includes(value as typeof MODULE_PRIORITIES[number])) return json({ error: "Invalid priority." }, 400);
        if (field === "riskLevel" && !RISK_LEVELS.includes(value as typeof RISK_LEVELS[number])) return json({ error: "Invalid risk level." }, 400);
        if (field === "progress" && (typeof value !== "number" || value < 0 || value > 100)) return json({ error: "Progress must be from 0 to 100." }, 400);
      }
      const columns = entries.map(([field]) => `${moduleFields[field as keyof typeof moduleFields]}=?`);
      await db.prepare(`UPDATE planner_modules SET ${columns.join(",")},updated_at=? WHERE id=?`).bind(...entries.map(([, value]) => value), now, parsed.data.moduleId).run();
      await audit({ moduleId: parsed.data.moduleId, actorId: user.userId, actorName: user.displayName, action: "module.updated", previousValue: current, newValue: parsed.data.changes });
      return json({ updated: true });
    }

    if (action === "module.approve") {
      const parsed = z.object({ moduleId: z.string().uuid() }).safeParse(input);
      if (!parsed.success) return json({ error: "Invalid module." }, 400);
      const current = await db.prepare("SELECT * FROM planner_modules WHERE id=?").bind(parsed.data.moduleId).first<Record<string, unknown>>();
      if (!current) return json({ error: "Module not found." }, 404);
      const features = await db.prepare("SELECT * FROM planner_features WHERE module_id=? AND archived_at IS NULL").bind(parsed.data.moduleId).all();
      const snapshot = JSON.stringify({ module: current, features: features.results, approvedAt: now, approvedBy: user.userId });
      await db.prepare("UPDATE planner_modules SET approval_state='Approved',approved_snapshot=?,updated_at=? WHERE id=?").bind(snapshot, now, parsed.data.moduleId).run();
      await db.prepare("UPDATE planner_features SET approval_state='Approved',updated_at=? WHERE module_id=? AND archived_at IS NULL").bind(now, parsed.data.moduleId).run();
      await audit({ moduleId: parsed.data.moduleId, actorId: user.userId, actorName: user.displayName, action: "module.approved", previousValue: current.approval_state, newValue: "Approved" });
      return json({ approved: true });
    }

    if (action === "module.archive") {
      const parsed = z.object({ moduleId: z.string().uuid(), restore: z.boolean().default(false) }).safeParse(input);
      if (!parsed.success) return json({ error: "Invalid module." }, 400);
      const archivedAt = parsed.data.restore ? null : now;
      await db.prepare("UPDATE planner_modules SET archived_at=?,updated_at=? WHERE id=?").bind(archivedAt, now, parsed.data.moduleId).run();
      await audit({ moduleId: parsed.data.moduleId, actorId: user.userId, actorName: user.displayName, action: parsed.data.restore ? "module.restored" : "module.archived", newValue: { archivedAt } });
      return json({ updated: true });
    }

    if (action === "feature.create") {
      const parsed = createFeature.safeParse(input);
      if (!parsed.success) return json({ error: "Complete the required feature fields." }, 400);
      const id = randomUUID();
      const value = parsed.data;
      await db.prepare(`INSERT INTO planner_features (id,module_id,name,description,functional_specification,acceptance_criteria,status,approval_state,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'Draft',?,?,?)`).bind(
        id, value.moduleId, value.name, value.description, value.functionalSpecification,
        value.acceptanceCriteria, value.status, user.userId, now, now,
      ).run();
      await db.prepare("UPDATE planner_modules SET updated_at=? WHERE id=?").bind(now, value.moduleId).run();
      await audit({ moduleId: value.moduleId, featureId: id, actorId: user.userId, actorName: user.displayName, action: "feature.created", newValue: value });
      return json({ id }, 201);
    }

    if (action === "feature.update") {
      const parsed = updateFeature.safeParse(input);
      if (!parsed.success) return json({ error: "Invalid feature update." }, 400);
      const current = await db.prepare("SELECT * FROM planner_features WHERE id=?").bind(parsed.data.featureId).first<Record<string, unknown>>();
      if (!current) return json({ error: "Feature not found." }, 404);
      if (current.approval_state === "Approved") return json({ error: "Approved features are protected. Submit a proposed change instead." }, 409);
      const entries = Object.entries(parsed.data.changes).filter(([field]) => field in featureFields);
      if (!entries.length) return json({ error: "No supported changes supplied." }, 400);
      const columns = entries.map(([field]) => `${featureFields[field as keyof typeof featureFields]}=?`);
      await db.prepare(`UPDATE planner_features SET ${columns.join(",")},updated_at=? WHERE id=?`).bind(...entries.map(([, value]) => value), now, parsed.data.featureId).run();
      await audit({ moduleId: String(current.module_id), featureId: parsed.data.featureId, actorId: user.userId, actorName: user.displayName, action: "feature.updated", previousValue: current, newValue: parsed.data.changes });
      return json({ updated: true });
    }

    if (action === "feature.archive") {
      const parsed = z.object({ featureId: z.string().uuid(), restore: z.boolean().default(false), reason: z.string().max(5000).default("") }).safeParse(input);
      if (!parsed.success) return json({ error: "Invalid feature." }, 400);
      const feature = await db.prepare("SELECT * FROM planner_features WHERE id=?").bind(parsed.data.featureId).first<Record<string, unknown>>();
      if (!feature) return json({ error: "Feature not found." }, 404);
      if (feature.approval_state === "Approved" && !parsed.data.restore) {
        const id = randomUUID();
        await db.prepare(`INSERT INTO planner_change_proposals (id,module_id,feature_id,proposal_type,previous_value,proposed_value,reason,status,created_by,created_by_name,created_at) VALUES (?,?,?,'feature.archive',?,? ,?,'Pending',?,?,?)`).bind(
          id, feature.module_id, feature.id, JSON.stringify(feature), JSON.stringify({ archived: true }), parsed.data.reason,
          user.userId, user.displayName, now,
        ).run();
        await audit({ moduleId: String(feature.module_id), featureId: parsed.data.featureId, actorId: user.userId, actorName: user.displayName, action: "feature.removal_proposed", newValue: { proposalId: id, reason: parsed.data.reason } });
        return json({ proposed: true, id }, 201);
      }
      const archivedAt = parsed.data.restore ? null : now;
      await db.prepare("UPDATE planner_features SET archived_at=?,updated_at=? WHERE id=?").bind(archivedAt, now, parsed.data.featureId).run();
      await audit({ moduleId: String(feature.module_id), featureId: parsed.data.featureId, actorId: user.userId, actorName: user.displayName, action: parsed.data.restore ? "feature.restored" : "feature.archived", newValue: { archivedAt } });
      return json({ updated: true });
    }

    if (action === "comment.create") {
      const parsed = z.object({ moduleId: z.string().uuid(), text: z.string().trim().min(1).max(20_000) }).safeParse(input);
      if (!parsed.success) return json({ error: "Comment text is required." }, 400);
      const id = randomUUID();
      await db.prepare("INSERT INTO planner_comments (id,module_id,author_id,author_name,body,created_at) VALUES (?,?,?,?,?,?)").bind(id, parsed.data.moduleId, user.userId, user.displayName, parsed.data.text, now).run();
      await audit({ moduleId: parsed.data.moduleId, actorId: user.userId, actorName: user.displayName, action: "comment.created", newValue: { commentId: id } });
      return json({ id }, 201);
    }

    if (action === "comment.update") {
      const parsed = z.object({ commentId: z.string().uuid(), text: z.string().trim().max(20_000).optional(), remove: z.boolean().default(false) }).safeParse(input);
      if (!parsed.success) return json({ error: "Invalid comment update." }, 400);
      const comment = await db.prepare("SELECT * FROM planner_comments WHERE id=?").bind(parsed.data.commentId).first<Record<string, unknown>>();
      if (!comment) return json({ error: "Comment not found." }, 404);
      if (comment.author_id !== user.userId) return json({ error: "Only the author can edit this comment." }, 403);
      if (parsed.data.remove) await db.prepare("UPDATE planner_comments SET removed_at=? WHERE id=?").bind(now, parsed.data.commentId).run();
      else if (parsed.data.text) await db.prepare("UPDATE planner_comments SET body=?,edited_at=? WHERE id=?").bind(parsed.data.text, now, parsed.data.commentId).run();
      await audit({ moduleId: String(comment.module_id), actorId: user.userId, actorName: user.displayName, action: parsed.data.remove ? "comment.removed" : "comment.edited", previousValue: comment.body, newValue: parsed.data.remove ? null : parsed.data.text });
      return json({ updated: true });
    }

    if (action === "proposal.create") {
      const parsed = z.object({
        moduleId: z.string().uuid(), featureId: z.string().uuid().nullable().optional(),
        proposalType: z.enum(["module.field", "feature.field", "feature.archive"]),
        fieldName: z.string().max(80).nullable().optional(), proposedValue: z.string().max(100_000).nullable().optional(),
        reason: z.string().trim().min(3).max(20_000),
      }).safeParse(input);
      if (!parsed.success) return json({ error: "Complete the proposed change." }, 400);
      const value = parsed.data;
      let previousValue: unknown = null;
      if (value.proposalType === "module.field" && value.fieldName && value.fieldName in moduleFields) {
        const moduleRecord = await db.prepare("SELECT * FROM planner_modules WHERE id=?").bind(value.moduleId).first<Record<string, unknown>>();
        previousValue = moduleRecord?.[moduleFields[value.fieldName as keyof typeof moduleFields]];
      } else if (value.featureId && value.fieldName && value.fieldName in featureFields) {
        const feature = await db.prepare("SELECT * FROM planner_features WHERE id=?").bind(value.featureId).first<Record<string, unknown>>();
        previousValue = feature?.[featureFields[value.fieldName as keyof typeof featureFields]];
      }
      const id = randomUUID();
      await db.prepare(`INSERT INTO planner_change_proposals (id,module_id,feature_id,proposal_type,field_name,previous_value,proposed_value,reason,status,created_by,created_by_name,created_at) VALUES (?,?,?,?,?,?,?,?,'Pending',?,?,?)`).bind(
        id, value.moduleId, value.featureId || null, value.proposalType, value.fieldName || null,
        previousValue == null ? null : JSON.stringify(previousValue), value.proposedValue == null ? null : JSON.stringify(value.proposedValue),
        value.reason, user.userId, user.displayName, now,
      ).run();
      await audit({ moduleId: value.moduleId, featureId: value.featureId, actorId: user.userId, actorName: user.displayName, action: "change.proposed", newValue: { proposalId: id, ...value } });
      return json({ id }, 201);
    }

    if (action === "proposal.review") {
      const parsed = z.object({ proposalId: z.string().uuid(), decision: z.enum(["Approved", "Rejected"]) }).safeParse(input);
      if (!parsed.success) return json({ error: "Invalid review decision." }, 400);
      const proposal = await db.prepare("SELECT * FROM planner_change_proposals WHERE id=?").bind(parsed.data.proposalId).first<Record<string, unknown>>();
      if (!proposal || proposal.status !== "Pending") return json({ error: "Pending proposal not found." }, 404);
      if (parsed.data.decision === "Approved") {
        const proposed = proposal.proposed_value ? JSON.parse(String(proposal.proposed_value)) : null;
        if (proposal.proposal_type === "feature.archive" && proposal.feature_id) {
          await db.prepare("UPDATE planner_features SET archived_at=?,updated_at=? WHERE id=?").bind(now, now, proposal.feature_id).run();
        } else if (proposal.proposal_type === "module.field" && typeof proposal.field_name === "string" && proposal.field_name in moduleFields) {
          const column = moduleFields[proposal.field_name as keyof typeof moduleFields];
          await db.prepare(`UPDATE planner_modules SET ${column}=?,updated_at=? WHERE id=?`).bind(proposed, now, proposal.module_id).run();
        } else if (proposal.proposal_type === "feature.field" && proposal.feature_id && typeof proposal.field_name === "string" && proposal.field_name in featureFields) {
          const column = featureFields[proposal.field_name as keyof typeof featureFields];
          await db.prepare(`UPDATE planner_features SET ${column}=?,updated_at=? WHERE id=?`).bind(proposed, now, proposal.feature_id).run();
        }
      }
      await db.prepare("UPDATE planner_change_proposals SET status=?,reviewed_by=?,reviewed_by_name=?,reviewed_at=? WHERE id=?").bind(parsed.data.decision, user.userId, user.displayName, now, parsed.data.proposalId).run();
      await audit({ moduleId: String(proposal.module_id), featureId: proposal.feature_id as string | null, actorId: user.userId, actorName: user.displayName, action: parsed.data.decision === "Approved" ? "change.approved" : "change.rejected", previousValue: proposal, newValue: { decision: parsed.data.decision } });
      return json({ reviewed: true });
    }

    if (action === "dependencies.set") {
      const parsed = z.object({ moduleId: z.string().uuid(), dependencyIds: z.array(z.string().uuid()).max(100) }).safeParse(input);
      if (!parsed.success) return json({ error: "Invalid dependencies." }, 400);
      const edges = await db.prepare("SELECT module_id AS moduleId,depends_on_module_id AS dependsOnModuleId FROM planner_dependencies").all<{ moduleId: string; dependsOnModuleId: string }>();
      if (wouldCreateDependencyCycle(parsed.data.moduleId, parsed.data.dependencyIds, edges.results))
        return json({ error: "This dependency would create a circular relationship." }, 409);
      const previous = edges.results.filter((edge) => edge.moduleId === parsed.data.moduleId);
      await db.prepare("DELETE FROM planner_dependencies WHERE module_id=?").bind(parsed.data.moduleId).run();
      for (const dependencyId of [...new Set(parsed.data.dependencyIds)]) {
        await db.prepare("INSERT INTO planner_dependencies (module_id,depends_on_module_id,created_by,created_at) VALUES (?,?,?,?)").bind(parsed.data.moduleId, dependencyId, user.userId, now).run();
      }
      await audit({ moduleId: parsed.data.moduleId, actorId: user.userId, actorName: user.displayName, action: "dependencies.updated", previousValue: previous, newValue: parsed.data.dependencyIds });
      return json({ updated: true });
    }

    if (action === "goal.save") {
      const parsed = z.object({
        id: z.string().uuid().optional(), name: z.string().trim().min(3).max(200), description: z.string().max(50_000).default(""),
        approvedScope: z.array(z.string().uuid()).default([]), completionCriteria: z.array(z.string().max(5000)).default([]),
        targetMilestones: z.array(z.string().max(5000)).default([]), approve: z.boolean().default(false),
      }).safeParse(input);
      if (!parsed.success) return json({ error: "Complete the project goal." }, 400);
      const value = parsed.data;
      if (value.approve && (!value.approvedScope.length || !value.completionCriteria.length || !value.targetMilestones.length))
        return json({ error: "An approved baseline requires included modules, completion criteria, and milestones." }, 400);
      const id = value.id || randomUUID();
      const current = value.id ? await db.prepare("SELECT * FROM planner_project_goals WHERE id=?").bind(id).first<Record<string, unknown>>() : null;
      const baselineVersion = current && value.approve ? Number(current.baseline_version) + 1 : Number(current?.baseline_version || 1);
      await db.prepare(`INSERT INTO planner_project_goals (id,name,description,approved_scope,completion_criteria,target_milestones,baseline_version,approval_state,approved_at,scoring_version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,?,'gather-evidence-v1',?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,approved_scope=excluded.approved_scope,completion_criteria=excluded.completion_criteria,target_milestones=excluded.target_milestones,baseline_version=excluded.baseline_version,approval_state=excluded.approval_state,approved_at=excluded.approved_at,updated_at=excluded.updated_at`).bind(
        id, value.name, value.description, JSON.stringify(value.approvedScope), JSON.stringify(value.completionCriteria), JSON.stringify(value.targetMilestones), baselineVersion,
        value.approve ? "Approved" : String(current?.approval_state || "Draft"), value.approve ? now : current?.approved_at || null,
        user.userId, Number(current?.created_at || now), now,
      ).run();
      return json({ id, baselineVersion });
    }

    if (action === "task.save") {
      const parsed = z.object({
        id: z.string().uuid().optional(), goalId: z.string().uuid(), moduleId: z.string().uuid(), name: z.string().trim().min(2).max(300),
        weight: z.number().refine((value) => TASK_WEIGHTS.includes(value as typeof TASK_WEIGHTS[number])), stage: z.enum(stages),
        baselineIncluded: z.boolean().default(false), approveWeight: z.boolean().default(false),
        requirementsEvidence: z.string().max(20_000).nullable().optional(), implementationEvidence: z.string().max(20_000).nullable().optional(),
        testsEvidence: z.string().max(20_000).nullable().optional(), sandboxEvidence: z.string().max(20_000).nullable().optional(),
        productionEvidence: z.string().max(20_000).nullable().optional(), blocker: z.string().max(20_000).nullable().optional(),
      }).safeParse(input);
      if (!parsed.success) return json({ error: "Complete the analyzer task." }, 400);
      const value = parsed.data;
      const id = value.id || randomUUID();
      const goal = await db.prepare("SELECT * FROM planner_project_goals WHERE id=?").bind(value.goalId).first<Record<string, unknown>>();
      if (!goal) return json({ error: "Project goal not found." }, 404);
      const current = value.id ? await db.prepare("SELECT * FROM planner_tasks WHERE id=?").bind(value.id).first<Record<string, unknown>>() : null;
      if (current?.weight_approved && Number(current.baseline_version) === Number(goal.baseline_version) && Number(current.weight) !== value.weight)
        return json({ error: "Approved task weights are fixed for this baseline. Approve a new baseline before changing the weight." }, 409);
      if (value.baselineIncluded && goal.approval_state !== "Approved") return json({ error: "Approve the project baseline before including scored tasks." }, 409);
      await db.prepare(`INSERT INTO planner_tasks (id,goal_id,module_id,name,weight,stage,requirements_evidence,implementation_evidence,tests_evidence,sandbox_evidence,production_evidence,blocker,baseline_version,baseline_included,weight_approved,weight_approved_at,weight_approved_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,weight=excluded.weight,stage=excluded.stage,requirements_evidence=excluded.requirements_evidence,implementation_evidence=excluded.implementation_evidence,tests_evidence=excluded.tests_evidence,sandbox_evidence=excluded.sandbox_evidence,production_evidence=excluded.production_evidence,blocker=excluded.blocker,baseline_version=excluded.baseline_version,baseline_included=excluded.baseline_included,weight_approved=excluded.weight_approved,weight_approved_at=excluded.weight_approved_at,weight_approved_by=excluded.weight_approved_by,updated_at=excluded.updated_at`).bind(
        id, value.goalId, value.moduleId, value.name, value.weight, value.stage, value.requirementsEvidence || null,
        value.implementationEvidence || null, value.testsEvidence || null, value.sandboxEvidence || null,
        value.productionEvidence || null, value.blocker || null, Number(goal.baseline_version), value.baselineIncluded,
        value.approveWeight || Boolean(current?.weight_approved), value.approveWeight ? now : current?.weight_approved_at || null,
        value.approveWeight ? user.userId : current?.weight_approved_by || null, now,
      ).run();
      await audit({ moduleId: value.moduleId, actorId: user.userId, actorName: user.displayName, action: value.approveWeight ? "task.weight.approved" : "task.updated", previousValue: current, newValue: value });
      return json({ id });
    }

    if (action === "analyzer.refresh") {
      const goal = await db.prepare("SELECT * FROM planner_project_goals ORDER BY created_at LIMIT 1").first<Record<string, unknown>>();
      if (!goal || goal.approval_state !== "Approved") return json({ error: "Create and approve a project goal before refreshing progress." }, 409);
      const recent = await db.prepare("SELECT id FROM planner_progress_snapshots WHERE goal_id=? AND created_at>? LIMIT 1").bind(goal.id, now - 5000).first();
      if (recent) return json({ error: "A project assessment was just created. Wait a moment before refreshing again." }, 409);
      const taskResult = await db.prepare("SELECT * FROM planner_tasks WHERE goal_id=? AND baseline_version=? AND baseline_included=1 AND weight_approved=1").bind(goal.id, goal.baseline_version).all<Record<string, unknown>>();
      if (!taskResult.results.length) return json({ error: "Not configured: approve fixed task weights for the current baseline before calculating completion." }, 409);
      const scoredTasks = taskResult.results.map((task) => ({
        id: String(task.id), weight: Number(task.weight), stage: task.stage as ProgressStage,
        requirementsEvidence: task.requirements_evidence as string | null,
        implementationEvidence: task.implementation_evidence as string | null,
        testsEvidence: task.tests_evidence as string | null,
        sandboxEvidence: task.sandbox_evidence as string | null,
        productionEvidence: task.production_evidence as string | null,
      }));
      const score = calculateProjectProgress(scoredTasks);
      const previous = await db.prepare("SELECT new_percentage AS percentage,created_at AS createdAt FROM planner_progress_snapshots WHERE goal_id=? ORDER BY created_at DESC LIMIT 1").bind(goal.id).first<{ percentage: number; createdAt: number }>();
      const modules = (await db.prepare("SELECT id,module_code AS moduleCode,name,status FROM planner_modules WHERE archived_at IS NULL").all<Record<string, unknown>>()).results;
      const issueRows = (await db.prepare("SELECT id,title,priority,status,page_url AS pageUrl FROM sandbox_issues WHERE status!='Resolved'").all<Record<string, unknown>>()).results;
      const criticalIssues = issueRows.filter((issue) => issue.priority === "Critical");
      const blockers = taskResult.results.filter((task) => String(task.blocker || "").trim()).map((task) => ({ taskId: task.id, moduleId: task.module_id, text: task.blocker }));
      let githubError: string | null = null;
      let githubChanges: Array<Record<string, unknown>> = [];
      try {
        const branch = String((await db.prepare("SELECT tracked_branch AS trackedBranch FROM planner_github_connections WHERE id='gather-github'").first<{ trackedBranch?: string }>())?.trackedBranch || "main");
        const synchronized = await synchronizeGatherGithub(branch, modules.map((module) => ({ id: String(module.id), moduleCode: String(module.moduleCode) })));
        githubChanges = synchronized.activities.filter((activity) => activity.occurredAt > Number(previous?.createdAt || 0));
      } catch (error) {
        githubError = error instanceof Error ? error.message : "GitHub synchronization was unavailable.";
      }
      const activityRows = (await db.prepare("SELECT event_type AS eventType,sha,matched_module_id AS matchedModuleId FROM planner_github_activities").all<Record<string, unknown>>()).results;
      const contradictions = buildContradictions(modules, taskResult.results.map((task) => ({ ...task, moduleId: task.module_id, testsEvidence: task.tests_evidence, implementationEvidence: task.implementation_evidence })), activityRows, criticalIssues);
      const recommendations = buildRecommendations(modules, taskResult.results.map((task) => ({ ...task, moduleId: task.module_id, requirementsEvidence: task.requirements_evidence, implementationEvidence: task.implementation_evidence, testsEvidence: task.tests_evidence, sandboxEvidence: task.sandbox_evidence, productionEvidence: task.production_evidence })), blockers, criticalIssues);
      const readiness = {
        sandbox: Math.round(taskResult.results.filter((task) => String(task.sandbox_evidence || "").trim()).length / taskResult.results.length * 100),
        production: Math.round(taskResult.results.filter((task) => String(task.production_evidence || "").trim()).length / taskResult.results.length * 100),
      };
      const moduleScores = [...new Set(taskResult.results.map((task) => String(task.module_id)))].map((moduleId) => {
        const selected = scoredTasks.filter((_, index) => String(taskResult.results[index].module_id) === moduleId);
        return { moduleId, ...calculateProjectProgress(selected) };
      });
      const tasksChanged = taskResult.results.filter((task) => Number(task.updated_at) > Number(previous?.createdAt || 0)).map((task) => task.id);
      const id = randomUUID();
      await db.prepare(`INSERT INTO planner_progress_snapshots (id,goal_id,previous_percentage,new_percentage,total_points,verified_points,evidence_reviewed,tasks_changed,scoring_version,baseline_version,initiated_by,module_scores,readiness_summary,blockers,github_changes,assessment_findings,configuration_snapshot,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        id, goal.id, previous?.percentage || 0, Math.round(score.percentage * 100), score.totalPoints,
        Math.round(score.verifiedPoints * 100), JSON.stringify(scoredTasks.map((task) => task.id)), JSON.stringify(tasksChanged),
        goal.scoring_version, goal.baseline_version, user.userId, JSON.stringify(moduleScores), JSON.stringify(readiness),
        JSON.stringify(blockers), JSON.stringify(githubChanges), JSON.stringify({ contradictions, recommendations, githubError, criticalIssues }),
        JSON.stringify({ approvedScope: goal.approved_scope, taskWeights: taskResult.results.map((task) => ({ id: task.id, weight: task.weight })) }), now,
      ).run();
      await db.prepare("UPDATE planner_project_goals SET overall_completion=?,last_assessment_at=?,updated_at=? WHERE id=?").bind(Math.round(score.percentage * 100), now, now, goal.id).run();
      return json({ ...score, snapshotId: id, readiness, blockers, contradictions, recommendations, githubError, aiAvailable: false, limitation: "No approved AI integration is configured. Progress was calculated from verified Module Planner evidence only." });
    }

    return json({ error: "Unsupported Module Planner action." }, 400);
  } catch (error) {
    console.error("Module Planner action failed:", error);
    return json({ error: error instanceof Error && error.message.includes("UNIQUE") ? "That module code is already in use." : "Unable to save this Module Planner change." }, 500);
  }
}
