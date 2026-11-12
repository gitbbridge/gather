import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";

export const integrationOrigin = process.env.GATHER_TEST_ORIGIN || "http://localhost:5173";

export async function stagingSession(email) {
  assert.equal(process.env.GATHER_ENVIRONMENT, "staging", "Integration authentication is staging-only.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const password = process.env.SANDBOX_DEMO_PASSWORD || "";
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
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
