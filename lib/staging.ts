import type { AppUser } from "@/lib/auth";

const SANDBOX_ORIGIN = "https://sandbox.gatherforgood.bid";

function configuredValue(name: string) {
  return process.env[name]?.trim() || "";
}

function missingOrPlaceholder(name: string) {
  const value = configuredValue(name);
  return !value || /(^your_|replace_me|owner-controlled|example\.com$)/i.test(value);
}

function configuredEmails(name: string) {
  return new Set(
    (process.env[name] || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSandboxEnvironment() {
  return process.env.GATHER_ENVIRONMENT === "staging";
}

export function sandboxSafetyErrors() {
  if (!isSandboxEnvironment()) return [];

  const errors: string[] = [];
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
  const projectRef = process.env.STAGING_SUPABASE_PROJECT_REF?.trim();
  const productionProjectRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  const stripePublic = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const stagingD1 = process.env.STAGING_D1_DATABASE_ID?.trim();
  const productionD1 = process.env.PRODUCTION_D1_DATABASE_ID?.trim();

  if (appUrl !== SANDBOX_ORIGIN)
    errors.push(`APP_URL must be ${SANDBOX_ORIGIN}.`);
  if (!projectRef) errors.push("STAGING_SUPABASE_PROJECT_REF is required.");
  if (!productionProjectRef)
    errors.push("PRODUCTION_SUPABASE_PROJECT_REF is required for isolation checks.");
  if (projectRef && projectRef === productionProjectRef)
    errors.push("Staging and production Supabase project refs must differ.");
  try {
    if (
      !supabaseUrl ||
      !projectRef ||
      new URL(supabaseUrl).hostname !== `${projectRef}.supabase.co`
    )
      errors.push("Supabase must match STAGING_SUPABASE_PROJECT_REF.");
  } catch {
    errors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid staging URL.");
  }
  if (missingOrPlaceholder("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"))
    errors.push("The staging Supabase publishable key is required.");
  if (missingOrPlaceholder("SUPABASE_SECRET_KEY"))
    errors.push("The staging Supabase secret key is required.");
  if (!stripeSecret?.startsWith("sk_test_"))
    errors.push("STRIPE_SECRET_KEY must be a Stripe test-mode key.");
  if (!stripePublic?.startsWith("pk_test_"))
    errors.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be test mode.");
  if (!configuredValue("STRIPE_WEBHOOK_SECRET").startsWith("whsec_"))
    errors.push("A staging Stripe webhook secret is required.");
  if (!stagingD1 || missingOrPlaceholder("STAGING_D1_DATABASE_ID"))
    errors.push("STAGING_D1_DATABASE_ID is required.");
  if (!productionD1 || missingOrPlaceholder("PRODUCTION_D1_DATABASE_ID"))
    errors.push("PRODUCTION_D1_DATABASE_ID is required for isolation checks.");
  if (stagingD1 && stagingD1 === productionD1)
    errors.push("Staging and production D1 database IDs must differ.");
  if (process.env.EMAIL_DELIVERY_MODE !== "test_sink")
    errors.push("EMAIL_DELIVERY_MODE must be test_sink.");
  if (missingOrPlaceholder("TEST_EMAIL_RECIPIENT"))
    errors.push("TEST_EMAIL_RECIPIENT is required.");
  if (missingOrPlaceholder("RESEND_API_KEY"))
    errors.push("A staging Resend API key is required.");
  if (missingOrPlaceholder("RESEND_FROM_EMAIL"))
    errors.push("A staging sender address is required.");
  if (!configuredEmails("SANDBOX_TESTER_EMAILS").size)
    errors.push("SANDBOX_TESTER_EMAILS is required.");
  if (!configuredEmails("PLATFORM_ADMIN_EMAILS").size)
    errors.push("PLATFORM_ADMIN_EMAILS is required.");
  if (process.env.REQUIRE_PRIVILEGED_MFA !== "true")
    errors.push("REQUIRE_PRIVILEGED_MFA must be true in the sandbox.");

  return errors;
}

export function assertSafeSandboxEnvironment() {
  if (!isSandboxEnvironment()) return;
  const errors = sandboxSafetyErrors();
  if (errors.length)
    throw new Error(`Unsafe staging configuration: ${errors.join(" ")}`);
}

export function isSandboxTester(user: AppUser | null) {
  if (!isSandboxEnvironment() || !user?.email) return false;
  return configuredEmails("SANDBOX_TESTER_EMAILS").has(
    user.email.toLowerCase(),
  );
}

export function sandboxEmailSink() {
  if (!isSandboxEnvironment()) return null;
  assertSafeSandboxEnvironment();
  return process.env.TEST_EMAIL_RECIPIENT!.trim();
}

export { SANDBOX_ORIGIN };
