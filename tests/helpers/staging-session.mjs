import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const integrationOrigin = process.env.GATHER_TEST_ORIGIN || "http://localhost:5173";

export async function stagingSession(email, options = {}) {
  assert.equal(process.env.GATHER_ENVIRONMENT, "staging", "Integration authentication is staging-only.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const password = process.env.SANDBOX_DEMO_PASSWORD || "";
  const secretKey = process.env.SUPABASE_SECRET_KEY || "";
  const stagingRef = process.env.STAGING_SUPABASE_PROJECT_REF || "";
  const productionRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF || "";
  assert.ok(url.includes(stagingRef) && !url.includes(productionRef), "Use the isolated staging Supabase project.");
  assert.ok(publishableKey && password, "Staging publishable key and demo password are required.");

  const jar = new Map();
  const client = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) => values.forEach(({ name, value }) => value ? jar.set(name, value) : jar.delete(name)),
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (options.accountType) {
    assert.ok(secretKey, "The staging Supabase secret key is required to prepare role fixtures.");
    assert.ok(data.user, "The staging test account could not be resolved.");
    const admin = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: profileError } = await admin.from("profiles").upsert(
      { id: data.user.id, account_type: options.accountType },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;
  }
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
