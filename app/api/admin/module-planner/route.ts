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

async function plannerState() {
  const db = database();
  const [modules, features, comments, proposals, dependencies, events, goals, tasks, snapshots, issues] = await Promise.all([
    db.prepare(`SELECT id,module_code AS moduleCode,name,description,purpose,functional_requirements AS functionalRequirements,acceptance_criteria AS acceptanceCriteria,status,priority,owner_id AS ownerId,owner_name AS ownerName,target_release AS targetRelease,risk_level AS riskLevel,progress,approval_state AS approvalState,approved_snapshot AS approvedSnapshot,archived_at AS archivedAt,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM planner_modules ORDER BY updated_at DESC`).all(),
    db.prepare(`SELECT id,module_id AS moduleId,name,description,functional_specification AS functionalSpecification,acceptance_criteria AS acceptanceCriteria,status,approval_state AS approvalState,archived_at AS archivedAt,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM planner_features ORDER BY created_at`).all(),
    db.prepare(`SELECT id,module_id AS moduleId,author_id AS authorId,author_name AS authorName,body,edited_at AS editedAt,removed_at AS removedAt,created_at AS createdAt FROM planner_comments ORDER BY created_at`).all(),
    db.prepare(`SELECT id,module_id AS moduleId,feature_id AS featureId,proposal_type AS proposalType,field_name AS fieldName,previous_value AS previousValue,proposed_value AS proposedValue,reason,status,created_by AS createdBy,created_by_name AS createdByName,reviewed_by AS reviewedBy,reviewed_by_name AS reviewedByName,reviewed_at AS reviewedAt,created_at AS createdAt FROM planner_change_proposals ORDER BY created_at DESC`).all(),
    db.prepare(`SELECT module_id AS moduleId,depends_on_module_id AS dependsOnModuleId,created_by AS createdBy,created_at AS createdAt FROM planner_dependencies`).all(),
    db.prepare(`SELECT id,module_id AS moduleId,feature_id AS featureId,actor_id AS actorId,actor_name AS actorName,action,previous_value AS previousValue,new_value AS newValue,metadata,created_at AS createdAt FROM planner_audit_events ORDER BY created_at DESC LIMIT 1000`).all(),
    db.prepare(`SELECT id,name,description,approved_scope AS approvedScope,completion_criteria AS completionCriteria,target_milestones AS targetMilestones,baseline_version AS baselineVersion,approval_state AS approvalState,approved_at AS approvedAt,scoring_version AS scoringVersion,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM planner_project_goals ORDER BY created_at LIMIT 1`).all(),
    db.prepare(`SELECT id,goal_id AS goalId,module_id AS moduleId,name,weight,stage,requirements_evidence AS requirementsEvidence,implementation_evidence AS implementationEvidence,tests_evidence AS testsEvidence,sandbox_evidence AS sandboxEvidence,production_evidence AS productionEvidence,blocker,updated_at AS updatedAt FROM planner_tasks ORDER BY updated_at DESC`).all(),
    db.prepare(`SELECT id,goal_id AS goalId,previous_percentage AS previousPercentage,new_percentage AS newPercentage,total_points AS totalPoints,verified_points AS verifiedPoints,evidence_reviewed AS evidenceReviewed,tasks_changed AS tasksChanged,scoring_version AS scoringVersion,baseline_version AS baselineVersion,initiated_by AS initiatedBy,created_at AS createdAt FROM planner_progress_snapshots ORDER BY created_at DESC LIMIT 100`).all(),
    db.prepare(`SELECT id,title,priority,status,page_url AS pageUrl,updated_at AS updatedAt FROM sandbox_issues WHERE status != 'Resolved' ORDER BY updated_at DESC LIMIT 100`).all(),
  ]);
  const moduleRows = modules.results as Array<Record<string, unknown>>;
  const taskRows = tasks.results as Array<Record<string, unknown>>;
  const score = calculateProjectProgress(taskRows.map((task) => ({
    id: String(task.id), weight: Number(task.weight), stage: task.stage as ProgressStage,
    requirementsEvidence: task.requirementsEvidence as string | null,
    implementationEvidence: task.implementationEvidence as string | null,
    testsEvidence: task.testsEvidence as string | null,
    sandboxEvidence: task.sandboxEvidence as string | null,
    productionEvidence: task.productionEvidence as string | null,
  })));
  const activeModules = moduleRows.filter((module) => !module.archivedAt);
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
    analyzer: { ...score, aiAvailable: false, scoringVersion: "gather-evidence-v1" },
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
        requirementsEvidence: z.string().max(20_000).nullable().optional(), implementationEvidence: z.string().max(20_000).nullable().optional(),
        testsEvidence: z.string().max(20_000).nullable().optional(), sandboxEvidence: z.string().max(20_000).nullable().optional(),
        productionEvidence: z.string().max(20_000).nullable().optional(), blocker: z.string().max(20_000).nullable().optional(),
      }).safeParse(input);
      if (!parsed.success) return json({ error: "Complete the analyzer task." }, 400);
      const value = parsed.data;
      const id = value.id || randomUUID();
      await db.prepare(`INSERT INTO planner_tasks (id,goal_id,module_id,name,weight,stage,requirements_evidence,implementation_evidence,tests_evidence,sandbox_evidence,production_evidence,blocker,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,weight=excluded.weight,stage=excluded.stage,requirements_evidence=excluded.requirements_evidence,implementation_evidence=excluded.implementation_evidence,tests_evidence=excluded.tests_evidence,sandbox_evidence=excluded.sandbox_evidence,production_evidence=excluded.production_evidence,blocker=excluded.blocker,updated_at=excluded.updated_at`).bind(
        id, value.goalId, value.moduleId, value.name, value.weight, value.stage, value.requirementsEvidence || null,
        value.implementationEvidence || null, value.testsEvidence || null, value.sandboxEvidence || null,
        value.productionEvidence || null, value.blocker || null, now,
      ).run();
      return json({ id });
    }

    if (action === "analyzer.refresh") {
      const goal = await db.prepare("SELECT * FROM planner_project_goals ORDER BY created_at LIMIT 1").first<Record<string, unknown>>();
      if (!goal) return json({ error: "Create and approve a project goal before refreshing progress." }, 409);
      const taskResult = await db.prepare("SELECT * FROM planner_tasks WHERE goal_id=?").bind(goal.id).all<Record<string, unknown>>();
      const scoredTasks = taskResult.results.map((task) => ({
        id: String(task.id), weight: Number(task.weight), stage: task.stage as ProgressStage,
        requirementsEvidence: task.requirements_evidence as string | null,
        implementationEvidence: task.implementation_evidence as string | null,
        testsEvidence: task.tests_evidence as string | null,
        sandboxEvidence: task.sandbox_evidence as string | null,
        productionEvidence: task.production_evidence as string | null,
      }));
      const score = calculateProjectProgress(scoredTasks);
      const previous = await db.prepare("SELECT new_percentage AS percentage FROM planner_progress_snapshots WHERE goal_id=? ORDER BY created_at DESC LIMIT 1").bind(goal.id).first<{ percentage: number }>();
      const id = randomUUID();
      await db.prepare(`INSERT INTO planner_progress_snapshots (id,goal_id,previous_percentage,new_percentage,total_points,verified_points,evidence_reviewed,tasks_changed,scoring_version,baseline_version,initiated_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        id, goal.id, previous?.percentage || 0, Math.round(score.percentage * 100), score.totalPoints,
        Math.round(score.verifiedPoints * 100), JSON.stringify(scoredTasks.map((task) => task.id)), JSON.stringify([]),
        goal.scoring_version, goal.baseline_version, user.userId, now,
      ).run();
      return json({ ...score, snapshotId: id, aiAvailable: false, limitation: "No approved AI integration is configured. Progress was calculated from verified Module Planner evidence only." });
    }

    return json({ error: "Unsupported Module Planner action." }, 400);
  } catch (error) {
    console.error("Module Planner action failed:", error);
    return json({ error: error instanceof Error && error.message.includes("UNIQUE") ? "That module code is already in use." : "Unable to save this Module Planner change." }, 500);
  }
}
