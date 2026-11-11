import { env } from "cloudflare:workers";

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowSeconds: number;
  identity?: string;
};

let tableReady: Promise<void> | null = null;

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clientAddress(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function ensureTable() {
  if (!env.DB) throw new Error("Security rate-limit storage is unavailable.");
  tableReady ??= env.DB.prepare(`CREATE TABLE IF NOT EXISTS security_rate_limits (
    key TEXT PRIMARY KEY,
    request_count INTEGER NOT NULL,
    reset_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run().then(() => undefined);
  await tableReady;
}

export async function rateLimitResponse(request: Request, options: RateLimitOptions): Promise<Response | null> {
  try {
    await ensureTable();
    const now = Date.now();
    const resetAt = now + options.windowSeconds * 1000;
    const subject = options.identity || clientAddress(request);
    const key = `${options.bucket}:${await digest(subject)}`;
    const row = await env.DB!.prepare(`
      INSERT INTO security_rate_limits (key,request_count,reset_at,updated_at)
      VALUES (?,1,?,?)
      ON CONFLICT(key) DO UPDATE SET
        request_count=CASE WHEN security_rate_limits.reset_at<=? THEN 1 ELSE security_rate_limits.request_count+1 END,
        reset_at=CASE WHEN security_rate_limits.reset_at<=? THEN excluded.reset_at ELSE security_rate_limits.reset_at END,
        updated_at=excluded.updated_at
      RETURNING request_count,reset_at
    `).bind(key, resetAt, now, now, now).first<{ request_count: number; reset_at: number }>();
    if (!row) throw new Error("Rate-limit state was not returned.");
    if (row.request_count <= options.limit) return null;
    const retryAfter = Math.max(1, Math.ceil((row.reset_at - now) / 1000));
    return Response.json({ error: "Too many requests. Please wait and try again." }, {
      status: 429,
      headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Security rate limiter unavailable", error);
    return Response.json({ error: "This action is temporarily unavailable. Please try again shortly." }, {
      status: 503,
      headers: { "Retry-After": "30", "Cache-Control": "no-store" },
    });
  }
}

export function trustedMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return origin === new URL(request.url).origin; } catch { return false; }
}

