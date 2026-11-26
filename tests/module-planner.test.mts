import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateProjectProgress,
  implementationBrief,
  isPlannerRecordId,
  verifiedTaskCompletion,
  wouldCreateDependencyCycle,
} from "../lib/module-planner.ts";

test("planner record identifiers support stable migration IDs and UUIDs", () => {
  assert.equal(isPlannerRecordId("module-auction-bidding"), true);
  assert.equal(isPlannerRecordId("crm-feature-contacts"), true);
  assert.equal(isPlannerRecordId("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isPlannerRecordId("../../unsafe"), false);
  assert.equal(isPlannerRecordId("contains spaces"), false);
  assert.equal(isPlannerRecordId(""), false);
});

test("progress cannot advance beyond the last stage with complete evidence", () => {
  const result = verifiedTaskCompletion({
    id: "task-1",
    weight: 5,
    stage: "Sandbox verified",
    requirementsEvidence: "Approved brief GR-001",
    implementationEvidence: "Commit abc123",
    testsEvidence: "Focused tests passed",
    sandboxEvidence: "",
  });
  assert.deepEqual(result, { stage: "Tests passed", completion: 0.75 });
});

test("weighted progress uses verified evidence rather than reported stage alone", () => {
  const result = calculateProjectProgress([
    {
      id: "complete",
      weight: 8,
      stage: "Production verified",
      requirementsEvidence: "approved",
      implementationEvidence: "commit",
      testsEvidence: "tests",
      sandboxEvidence: "sandbox",
      productionEvidence: "production",
    },
    { id: "unverified", weight: 2, stage: "Production verified" },
  ]);
  assert.equal(result.totalPoints, 10);
  assert.equal(result.verifiedPoints, 8);
  assert.equal(result.percentage, 80);
});

test("dependency validation rejects direct and indirect cycles", () => {
  const edges = [
    { moduleId: "billing", dependsOnModuleId: "auth" },
    { moduleId: "reports", dependsOnModuleId: "billing" },
  ];
  assert.equal(wouldCreateDependencyCycle("auth", ["reports"], edges), true);
  assert.equal(wouldCreateDependencyCycle("catalog", ["auth"], edges), false);
  assert.equal(wouldCreateDependencyCycle("catalog", ["catalog"], edges), true);
});

test("implementation briefs include approved records and exclude drafts", () => {
  const brief = implementationBrief({
    id: "module-1",
    moduleCode: "GR-001",
    name: "Organizer records",
    purpose: "Keep nonprofit records complete.",
    functionalRequirements: "Approved requirements",
    acceptanceCriteria: "Approved acceptance",
    status: "In progress",
    approvalState: "Approved",
    dependencies: [],
    features: [
      {
        name: "Supporter profiles",
        description: "Approved profile work",
        functionalSpecification: "Show complete activity history",
        acceptanceCriteria: "History is complete",
        approvalState: "Approved",
      },
      {
        name: "Unapproved idea",
        description: "Must not leak",
        functionalSpecification: "Secret draft specification",
        acceptanceCriteria: "Draft",
        approvalState: "Draft",
      },
    ],
  });
  assert.match(brief, /Supporter profiles/);
  assert.match(brief, /Approved requirements/);
  assert.doesNotMatch(brief, /Unapproved idea|Secret draft specification/);
});

