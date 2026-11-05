import { getAppUser } from "./auth";
import { isPlatformAdmin } from "./platform-admin";
import { database, nonprofitById } from "./nonprofits";
import { createSupabaseAdminClient } from "./supabase/admin";
import type { Auction } from "./auction";
import type { LiveRole } from "./gather-live";

export async function liveEventAccess(auctionId: string) {
  const user = await getAppUser();
  if (!user) return null;
  const row = await database().prepare("SELECT id,owner,state,nonprofit_id FROM auctions WHERE id=?").bind(auctionId)
    .first<{ id: string; owner: string; state: string; nonprofit_id: string | null }>();
  if (!row || !row.nonprofit_id) return null;
  let role: LiveRole | null = row.owner === user.userId || isPlatformAdmin(user) ? "event_director" : null;
  if (!role) {
    const { data } = await createSupabaseAdminClient().from("live_event_staff").select("role").eq("auction_id", auctionId).eq("user_id", user.userId).eq("active", true).limit(1).maybeSingle();
    role = (data?.role as LiveRole | undefined) || null;
  }
  if (!role) return null;
  const nonprofit = await nonprofitById(row.nonprofit_id);
  return { user, role, row, nonprofit, auction: JSON.parse(row.state) as Auction };
}
