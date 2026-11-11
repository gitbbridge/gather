import { getAppUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function platformSecurityAccess() {
  const user = await getAppUser();
  const administrator = isPlatformAdmin(user);
  let aal2 = false;
  if (administrator) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      aal2 = data?.currentLevel === "aal2";
    }
  }
  const enforcementEnabled = process.env.REQUIRE_PRIVILEGED_MFA === "true" || (process.env.NODE_ENV === "production" && process.env.REQUIRE_PRIVILEGED_MFA !== "false");
  return { user, administrator, aal2, enforcementEnabled, allowed: administrator && (!enforcementEnabled || aal2) };
}

export const privilegedAccessError = () => Response.json({
  error: "A verified authenticator is required for platform administration. Open Security from the organizer dashboard.",
  code: "MFA_REQUIRED",
}, { status: 403, headers: { "cache-control": "no-store" } });

