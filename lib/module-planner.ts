export const MODULE_STATUSES = [
  "Planned",
  "In progress",
  "Testing",
  "Needs review",
  "Approved",
  "Completed",
  "Blocked",
] as const;

export const MODULE_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const APPROVAL_STATES = ["Draft", "Pending", "Approved", "Rejected"] as const;
export const RISK_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
export const TASK_WEIGHTS = [1, 2, 3, 5, 8] as const;

// Administrator-created records use UUIDs, while forward-only migrations use
// readable stable IDs such as `module-auction-bidding`. Both are intentional
// database identifiers and must remain addressable through the planner API.
export const PLANNER_RECORD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function isPlannerRecordId(value: string) {
  return value.length <= 200 && PLANNER_RECORD_ID_PATTERN.test(value);
}

export const PROGRESS_STAGES = {
  "Not started": 0,
  "Requirements approved": 0.15,
  "Implementation complete": 0.55,
  "Tests passed": 0.75,
  "Sandbox verified": 0.9,
  "Production verified": 1,
} as const;

export type ProgressStage = keyof typeof PROGRESS_STAGES;

export type PlannerTaskScore = {
  id: string;
  weight: number;
  stage: ProgressStage;
  requirementsEvidence?: string | null;
  implementationEvidence?: string | null;
  testsEvidence?: string | null;
  sandboxEvidence?: string | null;
  productionEvidence?: string | null;
};

const evidenceForStage: Record<ProgressStage, keyof PlannerTaskScore | null> = {
  "Not started": null,
  "Requirements approved": "requirementsEvidence",
  "Implementation complete": "implementationEvidence",
  "Tests passed": "testsEvidence",
  "Sandbox verified": "sandboxEvidence",
  "Production verified": "productionEvidence",
};

export function verifiedTaskCompletion(task: PlannerTaskScore) {
  const stages = Object.keys(PROGRESS_STAGES) as ProgressStage[];
  const requestedIndex = stages.indexOf(task.stage);
  let verified: ProgressStage = "Not started";
  for (let index = 1; index <= requestedIndex; index++) {
    const stage = stages[index];
    const evidenceField = evidenceForStage[stage];
    if (!evidenceField || !String(task[evidenceField] || "").trim()) break;
    verified = stage;
  }
  return { stage: verified, completion: PROGRESS_STAGES[verified] };
}

export function calculateProjectProgress(tasks: PlannerTaskScore[]) {
  const totalPoints = tasks.reduce((sum, task) => sum + Math.max(0, task.weight), 0);
  const verifiedPoints = tasks.reduce((sum, task) => {
    const { completion } = verifiedTaskCompletion(task);
    return sum + Math.max(0, task.weight) * completion;
  }, 0);
  return {
    totalPoints,
    verifiedPoints,
    percentage: totalPoints ? Math.round((verifiedPoints / totalPoints) * 10_000) / 100 : 0,
  };
}

export function wouldCreateDependencyCycle(
  moduleId: string,
  dependencyIds: string[],
  existing: Array<{ moduleId: string; dependsOnModuleId: string }>,
) {
  if (dependencyIds.includes(moduleId)) return true;
  const graph = new Map<string, Set<string>>();
  for (const edge of existing.filter((edge) => edge.moduleId !== moduleId)) {
    if (!graph.has(edge.moduleId)) graph.set(edge.moduleId, new Set());
    graph.get(edge.moduleId)!.add(edge.dependsOnModuleId);
  }
  graph.set(moduleId, new Set(dependencyIds));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of graph.get(node) || []) if (visit(next)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return [...graph.keys()].some(visit);
}

type BriefModule = {
  id: string;
  moduleCode: string;
  name: string;
  purpose: string;
  functionalRequirements: string;
  acceptanceCriteria: string;
  status: string;
  approvalState: string;
  dependencies: Array<{ moduleCode: string; name: string }>;
  features: Array<{
    name: string;
    description: string;
    functionalSpecification: string;
    acceptanceCriteria: string;
    approvalState: string;
    archivedAt?: number | null;
  }>;
  blockers?: string[];
};

export function implementationBrief(module: BriefModule) {
  const approvedFeatures = module.features.filter(
    (feature) => feature.approvalState === "Approved" && !feature.archivedAt,
  );
  return [
    `GATHER IMPLEMENTATION BRIEF — ${module.name}`,
    `Module: ${module.moduleCode} (${module.id})`,
    `Status: ${module.status}`,
    `Approval: ${module.approvalState}`,
    "",
    "PURPOSE",
    module.purpose || "No approved purpose recorded.",
    "",
    "APPROVED REQUIREMENTS",
    module.approvalState === "Approved"
      ? module.functionalRequirements || "No approved requirements recorded."
      : "No approved module baseline. Draft and proposed content is excluded.",
    "",
    "APPROVED FEATURES",
    approvedFeatures.length
      ? approvedFeatures.map((feature) => `- ${feature.name}: ${feature.functionalSpecification || feature.description}`).join("\n")
      : "- No approved features recorded.",
    "",
    "ACCEPTANCE CRITERIA",
    module.approvalState === "Approved"
      ? module.acceptanceCriteria || "No approved acceptance criteria recorded."
      : "No approved acceptance criteria recorded.",
    "",
    "DEPENDENCIES",
    module.dependencies.length
      ? module.dependencies.map((dependency) => `- ${dependency.moduleCode}: ${dependency.name}`).join("\n")
      : "- None recorded.",
    "",
    "KNOWN BLOCKERS",
    module.blockers?.length ? module.blockers.map((blocker) => `- ${blocker}`).join("\n") : "- None recorded.",
    "",
    "Only approved records above are authoritative. Pending proposals are intentionally excluded.",
  ].join("\n");
}
