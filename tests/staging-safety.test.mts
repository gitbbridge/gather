import assert from "node:assert/strict";
import test from "node:test";
import {
  isSandboxEnvironment,
  sandboxSafetyErrors,
} from "../lib/staging.ts";

const stagingEnvironment = {
  GATHER_ENVIRONMENT: "staging",
  APP_URL: "https://sandbox.gatherforgood.bid",
  STAGING_SUPABASE_PROJECT_REF: "stagingproject",
  PRODUCTION_SUPABASE_PROJECT_REF: "productionproject",
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingproject.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  STAGING_D1_DATABASE_ID: "staging-d1",
  PRODUCTION_D1_DATABASE_ID: "production-d1",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_sandbox",
  STRIPE_SECRET_KEY: "sk_test_sandbox",
  STRIPE_WEBHOOK_SECRET: "whsec_sandbox",
  EMAIL_DELIVERY_MODE: "test_sink",
  TEST_EMAIL_RECIPIENT: "sandbox-inbox@gatherforgood.bid",
  RESEND_API_KEY: "re_sandbox",
  RESEND_FROM_EMAIL: "Gather Sandbox <sandbox@gatherforgood.bid>",
  SANDBOX_TESTER_EMAILS: "tester@gatherforgood.bid",
  PLATFORM_ADMIN_EMAILS: "admin@gatherforgood.bid",
  REQUIRE_PRIVILEGED_MFA: "true",
} as const;

async function withEnvironment(
  values: Record<string, string | undefined>,
  run: () => void,
) {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(values)) {
    previous.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    run();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("production mode does not enable sandbox behavior", async () => {
  await withEnvironment({ GATHER_ENVIRONMENT: "production" }, () => {
    assert.equal(isSandboxEnvironment(), false);
    assert.deepEqual(sandboxSafetyErrors(), []);
  });
});

test("a complete isolated staging configuration passes", async () => {
  await withEnvironment(stagingEnvironment, () => {
    assert.equal(isSandboxEnvironment(), true);
    assert.deepEqual(sandboxSafetyErrors(), []);
  });
});

test("staging rejects production Supabase, D1, and live Stripe credentials", async () => {
  await withEnvironment(
    {
      ...stagingEnvironment,
      STAGING_SUPABASE_PROJECT_REF: "productionproject",
      NEXT_PUBLIC_SUPABASE_URL: "https://productionproject.supabase.co",
      STAGING_D1_DATABASE_ID: "production-d1",
      STRIPE_SECRET_KEY: "sk_live_forbidden",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_live_forbidden",
    },
    () => {
      const errors = sandboxSafetyErrors().join(" ");
      assert.match(errors, /Supabase project refs must differ/);
      assert.match(errors, /D1 database IDs must differ/);
      assert.match(errors, /Stripe test-mode key/);
      assert.match(errors, /PUBLISHABLE_KEY must be test mode/);
    },
  );
});

test("staging rejects template placeholders and incomplete email isolation", async () => {
  await withEnvironment(
    {
      ...stagingEnvironment,
      SUPABASE_SECRET_KEY: "your_staging_secret_key",
      STAGING_D1_DATABASE_ID: "your_staging_d1_database_id",
      RESEND_API_KEY: "re_replace_me",
      TEST_EMAIL_RECIPIENT: "owner-controlled-test-email@example.com",
      REQUIRE_PRIVILEGED_MFA: "false",
    },
    () => {
      const errors = sandboxSafetyErrors().join(" ");
      assert.match(errors, /Supabase secret key is required/);
      assert.match(errors, /STAGING_D1_DATABASE_ID is required/);
      assert.match(errors, /Resend API key is required/);
      assert.match(errors, /TEST_EMAIL_RECIPIENT is required/);
      assert.match(errors, /REQUIRE_PRIVILEGED_MFA must be true/);
    },
  );
});
