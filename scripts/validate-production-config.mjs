const PRODUCTION_ORIGIN = "https://gatherforgood.bid";
const launchMode = process.argv.includes("--launch");

const looksLikePlaceholder = (value) =>
  /(^your_|replace_me|owner-controlled|example\.com$)/i.test(value);

export function productionConfigurationErrors(environment, { launch = false } = {}) {
  const failures = [];
  const value = (name) => environment[name]?.trim() || "";
  const required = (name) => {
    const configured = value(name);
    if (!configured) failures.push(`${name} is required.`);
    else if (looksLikePlaceholder(configured))
      failures.push(`${name} still contains a template placeholder.`);
    return configured;
  };

  const appUrl = required("APP_URL").replace(/\/$/, "");
  const productionSupabase = required("PRODUCTION_SUPABASE_PROJECT_REF");
  const stagingSupabase = required("STAGING_SUPABASE_PROJECT_REF");
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const productionD1 = required("PRODUCTION_D1_DATABASE_ID");
  const stagingD1 = required("STAGING_D1_DATABASE_ID");
  const stripePublic = required("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const stripeSecret = required("STRIPE_SECRET_KEY");
  const webhookSecret = required("STRIPE_WEBHOOK_SECRET");
  const sender = required("RESEND_FROM_EMAIL");

  required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  required("SUPABASE_SECRET_KEY");
  required("PLATFORM_ADMIN_EMAILS");
  required("RESEND_API_KEY");

  if (value("GATHER_ENVIRONMENT") === "staging")
    failures.push("GATHER_ENVIRONMENT must not equal staging in production.");
  if (appUrl && appUrl !== PRODUCTION_ORIGIN)
    failures.push(`APP_URL must equal ${PRODUCTION_ORIGIN}.`);
  if (productionSupabase && stagingSupabase && productionSupabase === stagingSupabase)
    failures.push("Production and staging Supabase project refs must differ.");
  if (supabaseUrl && productionSupabase) {
    try {
      if (new URL(supabaseUrl).hostname !== `${productionSupabase}.supabase.co`)
        failures.push("NEXT_PUBLIC_SUPABASE_URL does not match PRODUCTION_SUPABASE_PROJECT_REF.");
    } catch {
      failures.push("NEXT_PUBLIC_SUPABASE_URL is invalid.");
    }
  }
  if (productionD1 && stagingD1 && productionD1 === stagingD1)
    failures.push("Production and staging D1 database IDs must differ.");

  const publicMode = stripePublic.startsWith("pk_live_")
    ? "live"
    : stripePublic.startsWith("pk_test_")
      ? "test"
      : "invalid";
  const secretMode = stripeSecret.startsWith("sk_live_")
    ? "live"
    : stripeSecret.startsWith("sk_test_")
      ? "test"
      : "invalid";
  if (stripePublic && publicMode === "invalid") failures.push("Stripe publishable key has an invalid mode prefix.");
  if (stripeSecret && secretMode === "invalid") failures.push("Stripe secret key has an invalid mode prefix.");
  if (publicMode !== "invalid" && secretMode !== "invalid" && publicMode !== secretMode)
    failures.push("Stripe publishable and secret keys use different modes.");
  if (launch && (publicMode !== "live" || secretMode !== "live"))
    failures.push("Launch validation requires Stripe live-mode keys.");
  if (webhookSecret && !webhookSecret.startsWith("whsec_"))
    failures.push("STRIPE_WEBHOOK_SECRET is invalid.");

  if (sender && !sender.toLowerCase().includes("noreply@gatherforgood.bid"))
    failures.push("RESEND_FROM_EMAIL must use noreply@gatherforgood.bid.");
  if (launch && value("EMAIL_DELIVERY_MODE") !== "live")
    failures.push("Launch validation requires EMAIL_DELIVERY_MODE=live.");
  if (value("EMAIL_DELIVERY_MODE") === "test_sink")
    failures.push("Production must not use the staging email test sink.");
  if (value("TEST_EMAIL_RECIPIENT"))
    failures.push("TEST_EMAIL_RECIPIENT must be empty in production.");
  if (value("SANDBOX_DEMO_PASSWORD"))
    failures.push("SANDBOX_DEMO_PASSWORD must be empty in production.");
  if (value("REQUIRE_PRIVILEGED_MFA") !== "true")
    failures.push("REQUIRE_PRIVILEGED_MFA must equal true.");
  if (value("PUBLISH_DRAFT_LEGAL_PAGES") !== "false")
    failures.push("PUBLISH_DRAFT_LEGAL_PAGES must equal false until legal approval.");

  return failures;
}

const executedDirectly = process.argv[1] &&
  new URL(import.meta.url).pathname.replace(/^\/[A-Za-z]:/, (match) => match.slice(1))
    .replaceAll("/", "\\").toLowerCase() === process.argv[1].toLowerCase();

if (executedDirectly) {
  const failures = productionConfigurationErrors(process.env, { launch: launchMode });
  if (failures.length) {
    console.error("Gather production configuration is not ready:\n- " + failures.join("\n- "));
    process.exit(1);
  }
  console.log(`Gather production configuration passed ${launchMode ? "launch" : "baseline"} checks.`);
  console.log("No credential values were printed.");
}
