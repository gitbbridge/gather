const failures = [];
const looksLikePlaceholder = (value) =>
  /(^your_|replace_me|owner-controlled|example\.com$)/i.test(value);
const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) failures.push(`${name} is required.`);
  else if (looksLikePlaceholder(value)) failures.push(`${name} still contains a template placeholder.`);
  return value || "";
};

const environment = required("GATHER_ENVIRONMENT");
const appUrl = required("APP_URL").replace(/\/$/, "");
const stagingSupabase = required("STAGING_SUPABASE_PROJECT_REF");
const productionSupabase = required("PRODUCTION_SUPABASE_PROJECT_REF");
const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
const stagingD1 = required("STAGING_D1_DATABASE_ID");
const productionD1 = required("PRODUCTION_D1_DATABASE_ID");
const stripePublic = required("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
const stripeSecret = required("STRIPE_SECRET_KEY");
const webhookSecret = required("STRIPE_WEBHOOK_SECRET");

required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
required("SUPABASE_SECRET_KEY");
required("PLATFORM_ADMIN_EMAILS");
required("SANDBOX_TESTER_EMAILS");
required("TEST_EMAIL_RECIPIENT");
required("RESEND_API_KEY");

if (environment !== "staging") failures.push("GATHER_ENVIRONMENT must equal staging.");
if (appUrl !== "https://sandbox.gatherforgood.bid") failures.push("APP_URL must equal the sandbox origin.");
if (stagingSupabase === productionSupabase) failures.push("Staging and production Supabase project refs must differ.");
try {
  if (new URL(supabaseUrl).hostname !== `${stagingSupabase}.supabase.co`)
    failures.push("NEXT_PUBLIC_SUPABASE_URL does not match STAGING_SUPABASE_PROJECT_REF.");
} catch {
  failures.push("NEXT_PUBLIC_SUPABASE_URL is invalid.");
}
if (stagingD1 === productionD1) failures.push("Staging and production D1 IDs must differ.");
if (!stripePublic.startsWith("pk_test_")) failures.push("Stripe publishable key is not test mode.");
if (!stripeSecret.startsWith("sk_test_")) failures.push("Stripe secret key is not test mode.");
if (!webhookSecret.startsWith("whsec_")) failures.push("Stripe webhook secret is invalid.");
if (process.env.EMAIL_DELIVERY_MODE !== "test_sink") failures.push("EMAIL_DELIVERY_MODE must equal test_sink.");
if (process.env.REQUIRE_PRIVILEGED_MFA !== "true") failures.push("REQUIRE_PRIVILEGED_MFA must equal true for sandbox administrators.");

if (failures.length) {
  console.error("Gather staging configuration is unsafe:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log("Gather staging configuration passed isolation checks.");
console.log("No credential values were printed.");
