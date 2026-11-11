import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { productionSecurityHeaders } from "../lib/security/headers.ts";

test("production responses define core browser security headers", () => {
  const headers = new Map(productionSecurityHeaders.map((entry) => [entry.key, entry.value]));
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  assert.match(headers.get("Content-Security-Policy") || "", /frame-ancestors 'none'/);
  assert.match(headers.get("Content-Security-Policy") || "", /object-src 'none'/);
  assert.match(headers.get("Strict-Transport-Security") || "", /max-age=31536000/);
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.match(headers.get("Permissions-Policy") || "", /camera=\(\)/);
  assert.match(middleware, /productionSecurityHeaders/);
  assert.match(middleware, /response\.headers\.set/);
});

test("high-risk API routes use centralized throttling", () => {
  for (const path of [
    "../app/api/auction/route.ts",
    "../app/api/invoices/checkout/route.ts",
    "../app/api/tickets/checkout/route.ts",
    "../app/api/direct-offers/checkout/route.ts",
    "../app/api/email-settings/route.ts",
    "../app/api/sponsors/portal/exchange/route.ts",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /rateLimitResponse/);
    assert.match(source, /trustedMutationOrigin/);
  }
});

test("live financial tables are explicitly server-only", () => {
  const migration = readFileSync(new URL("../supabase/migrations/202611100001_security_hardening.sql", import.meta.url), "utf8");
  assert.match(migration, /revoke all on public\.live_event_sessions[\s\S]*from anon, authenticated/);
  assert.match(migration, /alter function public\.record_live_bid[\s\S]*set search_path = ''/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
});

test("local environment files remain excluded from source control", () => {
  const ignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
  assert.match(ignore, /^\.env\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
});
