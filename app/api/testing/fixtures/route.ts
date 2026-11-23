import { database } from "@/lib/nonprofits";
import { sandboxAccess, sandboxAccessError } from "@/lib/sandbox-access";
import { z } from "zod";

export const dynamic = "force-dynamic";

const input = z.object({
  suite: z.literal("nonprofits-integration"),
});

const fixtureAuctionNames = [
  "Neighborhood Learning Fund auction",
  "Community Garden Fund auction",
] as const;

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });

export async function DELETE(request: Request) {
  const access = await sandboxAccess();
  if (!access.allowed) return sandboxAccessError(access.reason);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return json({ error: "Invalid origin." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 500)
    return json({ error: "Request too large." }, 413);

  try {
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Unknown fixture suite." }, 400);
    const rows = await database()
      .prepare(
        "SELECT id, nonprofit_id AS nonprofitId FROM auctions WHERE json_extract(state, '$.name') IN (?, ?)",
      )
      .bind(...fixtureAuctionNames)
      .all<{ id: string; nonprofitId: string | null }>();
    const auctionIds = rows.results.map((row) => row.id);
    const nonprofitIds = rows.results
      .map((row) => row.nonprofitId)
      .filter((id): id is string => Boolean(id));

    const statements = [
      ...auctionIds.flatMap((id) => [
        database().prepare("DELETE FROM closeout_records WHERE auction_id=?").bind(id),
        database().prepare("DELETE FROM auctions WHERE id=?").bind(id),
      ]),
      ...nonprofitIds.flatMap((id) => [
        database().prepare("DELETE FROM registrations WHERE nonprofit_id=?").bind(id),
        database().prepare("DELETE FROM nonprofit_homepages WHERE nonprofit_id=?").bind(id),
        database().prepare("DELETE FROM nonprofit_payment_accounts WHERE nonprofit_id=?").bind(id),
        database().prepare("DELETE FROM nonprofits WHERE id=?").bind(id),
      ]),
    ];
    if (statements.length) await database().batch(statements);
    return json({ removed: auctionIds.length });
  } catch (error) {
    console.error("Unable to clean sandbox fixtures:", error);
    return json({ error: "Unable to clean sandbox fixtures." }, 500);
  }
}
