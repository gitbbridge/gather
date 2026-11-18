import test from "node:test";
import assert from "node:assert/strict";
import { exactModuleAssociation, githubReferenceUrl } from "../lib/module-planner-github.ts";

const modules = [
  { id: "one", moduleCode: "GR-008" },
  { id: "two", moduleCode: "GR-009" },
];

test("GitHub association requires one exact module identifier", () => {
  assert.deepEqual(exactModuleAssociation("GR-008: connect repository", modules), { moduleId: "one", method: "exact_task_identifier" });
  assert.equal(exactModuleAssociation("update repository integration", modules), null);
  assert.equal(exactModuleAssociation("GR-008 and GR-009 combined", modules), null);
  assert.equal(exactModuleAssociation("GR-0088 belongs elsewhere", modules), null);
});

test("GitHub links are derived from validated references", () => {
  assert.equal(githubReferenceUrl("commit", "abc1234"), "https://github.com/gitbbridge/gather/commit/abc1234");
  assert.equal(githubReferenceUrl("pull_request", "42"), "https://github.com/gitbbridge/gather/pull/42");
  assert.equal(githubReferenceUrl("commit", "not-a-sha"), null);
});
