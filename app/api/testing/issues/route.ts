import { createHash, randomUUID } from "node:crypto";
import { database } from "@/lib/nonprofits";
import { sandboxAccess, sandboxAccessError } from "@/lib/sandbox-access";
import { z } from "zod";

export const dynamic = "force-dynamic";

const roles = [
  "Nonprofit Organizer",
  "Donor / Bidder",
  "Gather Platform Administrator",
  "Give Holidays Fulfillment Manager",
] as const;
const types = ["Bug", "Requested Change", "Missing Functionality", "Observation"] as const;
const priorities = ["Low", "Medium", "High", "Critical"] as const;
const statuses = ["Open", "In Review", "Resolved", "Retest Required"] as const;

const issueInput = z.object({
  title: z.string().trim().min(3).max(120),
  userRole: z.enum(roles),
  workflowArea: z.string().trim().min(2).max(120),
  issueType: z.enum(types),
  priority: z.enum(priorities),
  description: z.string().trim().min(5).max(5000),
  expectedBehavior: z.string().trim().max(3000).default(""),
  actualBehavior: z.string().trim().max(3000).default(""),
  pageUrl: z.string().trim().url().max(1000),
});

const issueUpdate = z.object({
  id: z.string().uuid(),
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  title: z.string().trim().min(3).max(120).optional(),
}).refine((value) => value.status || value.priority || value.title, "No changes supplied.");

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store" },
});

function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

async function parsedBody(request: Request) {
  const body = await request.text();
  if (body.length > 25_000) throw new Error("Request too large.");
  return JSON.parse(body) as unknown;
}

export async function GET(request: Request) {
  const access = await sandboxAccess();
  if (!access.allowed) return sandboxAccessError(access.reason);
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const role = url.searchParams.get("role");
  const filters: string[] = [];
  const values: string[] = [];
  if (status && statuses.includes(status as typeof statuses[number])) {
    filters.push("status = ?"); values.push(status);
  }
  if (priority && priorities.includes(priority as typeof priorities[number])) {
    filters.push("priority = ?"); values.push(priority);
  }
  if (role && roles.includes(role as typeof roles[number])) {
    filters.push("user_role = ?"); values.push(role);
  }
  const query = `SELECT id,title,user_role AS userRole,workflow_area AS workflowArea,issue_type AS issueType,priority,description,expected_behavior AS expectedBehavior,actual_behavior AS actualBehavior,page_url AS pageUrl,status,created_at AS createdAt,updated_at AS updatedAt FROM sandbox_issues${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT 250`;
  const result = await database().prepare(query).bind(...values).all();
  return json({ issues: result.results });
}

export async function POST(request: Request) {
  const access = await sandboxAccess();
  if (!access.allowed || !access.user) return sandboxAccessError(access.reason);
  if (!sameOrigin(request)) return json({ error: "Invalid origin." }, 403);
  try {
    const parsed = issueInput.safeParse(await parsedBody(request));
    if (!parsed.success) return json({ error: "Please complete the required issue fields." }, 400);
    const value = parsed.data;
    const fingerprint = createHash("sha256").update(JSON.stringify({
      createdBy: access.user.userId,
      title: value.title.toLowerCase(),
      role: value.userRole,
      area: value.workflowArea.toLowerCase(),
      type: value.issueType,
      description: value.description.toLowerCase(),
      pageUrl: value.pageUrl,
    })).digest("hex");
    const existing = await database().prepare("SELECT id FROM sandbox_issues WHERE fingerprint = ?").bind(fingerprint).first<{ id: string }>();
    if (existing) return json({ id: existing.id, duplicate: true });
    const id = randomUUID();
    const now = Date.now();
    await database().prepare(`INSERT INTO sandbox_issues (id,fingerprint,created_by,title,user_role,workflow_area,issue_type,priority,description,expected_behavior,actual_behavior,page_url,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id, fingerprint, access.user.userId, value.title, value.userRole,
      value.workflowArea, value.issueType, value.priority, value.description,
      value.expectedBehavior, value.actualBehavior, value.pageUrl, "Open", now, now,
    ).run();
    return json({ id, duplicate: false }, 201);
  } catch (error) {
    console.error("Unable to save sandbox issue:", error);
    return json({ error: "Unable to save this issue." }, 500);
  }
}

export async function PATCH(request: Request) {
  const access = await sandboxAccess();
  if (!access.allowed) return sandboxAccessError(access.reason);
  if (!sameOrigin(request)) return json({ error: "Invalid origin." }, 403);
  try {
    const parsed = issueUpdate.safeParse(await parsedBody(request));
    if (!parsed.success) return json({ error: "Invalid issue update." }, 400);
    const updates: string[] = [];
    const values: Array<string | number> = [];
    for (const [field, column] of [["title", "title"], ["priority", "priority"], ["status", "status"]] as const) {
      const value = parsed.data[field];
      if (value) { updates.push(`${column} = ?`); values.push(value); }
    }
    updates.push("updated_at = ?"); values.push(Date.now(), parsed.data.id);
    const result = await database().prepare(`UPDATE sandbox_issues SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    if (!result.meta.changes) return json({ error: "Issue not found." }, 404);
    return json({ updated: true });
  } catch (error) {
    console.error("Unable to update sandbox issue:", error);
    return json({ error: "Unable to update this issue." }, 500);
  }
}
