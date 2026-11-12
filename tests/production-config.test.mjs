import assert from "node:assert/strict";
import test from "node:test";
import { productionConfigurationErrors } from "../scripts/validate-production-config.mjs";

const safeProduction = {
  GATHER_ENVIRONMENT: "production",
  APP_URL: "https://gatherforgood.bid",
  PRODUCTION_SUPABASE_PROJECT_REF: "productionref",
  STAGING_SUPABASE_PROJECT_REF: "stagingref",
  NEXT_PUBLIC_SUPABASE_URL: "https://productionref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_value",
  SUPABASE_SECRET_KEY: "sb_secret_value",
  PRODUCTION_D1_DATABASE_ID: "production-d1",
  STAGING_D1_DATABASE_ID: "staging-d1",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_value",
  STRIPE_SECRET_KEY: "sk_live_value",
  STRIPE_WEBHOOK_SECRET: "whsec_value",
  PLATFORM_ADMIN_EMAILS: "admin@gatherforgood.bid",
  RESEND_API_KEY: "re_value",
  RESEND_FROM_EMAIL: "Gather for Good <noreply@gatherforgood.bid>",
  EMAIL_DELIVERY_MODE: "live",
  REQUIRE_PRIVILEGED_MFA: "true",
  PUBLISH_DRAFT_LEGAL_PAGES: "false",
};

test("accepts an isolated production launch configuration", () => {
  assert.deepEqual(productionConfigurationErrors(safeProduction, { launch: true }), []);
});

test("rejects staging resources and test delivery in production", () => {
  const unsafe = {
    ...safeProduction,
    GATHER_ENVIRONMENT: "staging",
    APP_URL: "https://sandbox.gatherforgood.bid",
    PRODUCTION_SUPABASE_PROJECT_REF: "stagingref",
    PRODUCTION_D1_DATABASE_ID: "staging-d1",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_value",
    STRIPE_SECRET_KEY: "sk_test_value",
    EMAIL_DELIVERY_MODE: "test_sink",
    TEST_EMAIL_RECIPIENT: "owner@example.org",
    SANDBOX_DEMO_PASSWORD: "must-not-be-here",
    REQUIRE_PRIVILEGED_MFA: "false",
  };
  const failures = productionConfigurationErrors(unsafe, { launch: true });
  assert.ok(failures.length >= 8);
  assert.ok(failures.some((message) => message.includes("must not equal staging")));
  assert.ok(failures.some((message) => message.includes("live-mode keys")));
  assert.ok(failures.some((message) => message.includes("test sink")));
});
