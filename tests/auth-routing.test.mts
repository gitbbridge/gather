import test from "node:test";
import assert from "node:assert/strict";
import { roleDestination } from "../lib/account-routing.ts";
test("new nonprofit organizers enter onboarding", () =>
  assert.equal(
    roleDestination({
      target: "/",
      organizer: false,
      accountType: "organizer",
    }),
    "/onboarding",
  ));
test("existing organizers enter nonprofit admin", () =>
  assert.equal(
    roleDestination({ target: "/", organizer: true, accountType: "organizer" }),
    "/admin",
  ));
test("returning organizers do not repeat onboarding after sign in", () =>
  assert.equal(
    roleDestination({
      target: "/onboarding",
      organizer: true,
      accountType: "organizer",
    }),
    "/admin",
  ));
test("supporters enter supporter home", () =>
  assert.equal(
    roleDestination({
      target: "/",
      organizer: false,
      accountType: "supporter",
    }),
    "/account",
  ));
test("bidder registration returns to the selected nonprofit auction", () =>
  assert.equal(
    roleDestination({
      target: "/n/community/join?auction=123",
      organizer: false,
      accountType: "supporter",
    }),
    "/n/community/join?auction=123",
  ));
test("supporters cannot route themselves into admin", () =>
  assert.equal(
    roleDestination({
      target: "/admin",
      organizer: false,
      accountType: "supporter",
    }),
    "/account",
  ));
