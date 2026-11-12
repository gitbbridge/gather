import assert from "node:assert/strict";
import test from "node:test";
import { classifyLiveDisplayResponse } from "../lib/live-display.ts";

test("missing and forbidden live events are terminal display failures", () => {
  assert.equal(classifyLiveDisplayResponse(404), "terminal");
  assert.equal(classifyLiveDisplayResponse(403), "terminal");
});

test("server and network-adjacent failures remain retryable", () => {
  assert.equal(classifyLiveDisplayResponse(500), "retryable");
  assert.equal(classifyLiveDisplayResponse(503), "retryable");
});

test("successful live responses update the display", () => {
  assert.equal(classifyLiveDisplayResponse(200), "success");
});
