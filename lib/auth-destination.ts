import type { AppUser } from "./auth";
import { safeReturnPath } from "./auth";
import { database } from "./nonprofits";
import { createSupabaseAdminClient } from "./supabase/admin";
import { isPlatformAdmin } from "./platform-admin";
import { roleDestination } from "./account-routing";
export async function postAuthDestination(user: AppUser, requested = "/") {
  const target = safeReturnPath(requested);
  if (isPlatformAdmin(user))
    return roleDestination({ target, organizer: true, platformAdmin: true });
  let organizer = false;
  try {
    organizer = Boolean(
      await database()
        .prepare("SELECT id FROM nonprofits WHERE owner=? LIMIT 1")
        .bind(user.userId)
        .first(),
    );
  } catch {
    /* Supabase membership remains the fallback. */
  }
  const client = createSupabaseAdminClient();
  const [
    { data: membership },
    { data: existingAuction },
    { data: profile },
  ] = await Promise.all([
    client
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.userId)
      .limit(1)
      .maybeSingle(),
    client
      .from("auctions")
      .select("id")
      .eq("created_by", user.userId)
      .limit(1)
      .maybeSingle(),
    client
      .from("profiles")
      .select("account_type")
      .eq("id", user.userId)
      .maybeSingle(),
  ]);
  organizer = organizer || Boolean(membership) || Boolean(existingAuction);
  return roleDestination({
    target,
    organizer,
    accountType: profile?.account_type,
  });
}
export async function canCreateOrganization(user: AppUser) {
  if (isPlatformAdmin(user) || user.provider === "chatgpt") return true;
  try {
    if (
      await database()
        .prepare("SELECT id FROM nonprofits WHERE owner=? LIMIT 1")
        .bind(user.userId)
        .first()
    )
      return true;
  } catch {}
  const { data } = await createSupabaseAdminClient()
    .from("profiles")
    .select("account_type")
    .eq("id", user.userId)
    .maybeSingle();
  return data?.account_type === "organizer";
}
