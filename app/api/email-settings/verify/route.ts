import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function digest(value: string) {
  return Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ).toString("hex");
}

export async function GET(request: Request) {
  const url = new URL(request.url),
    organizationId = url.searchParams.get("organization") || "",
    token = url.searchParams.get("token") || "";
  if (!organizationId || !token)
    return Response.redirect(
      new URL("/auth?notice=invalid-email-verification", url.origin),
    );
  const client = createSupabaseAdminClient();
  const { data } = await client
    .from("organization_email_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const valid =
    data?.pending_reply_to_email &&
    data.reply_to_verification_hash === (await digest(token)) &&
    new Date(data.reply_to_verification_expires_at || 0) > new Date();
  if (!valid)
    return Response.redirect(
      new URL("/auth?notice=expired-email-verification", url.origin),
    );
  await client
    .from("organization_email_settings")
    .update({
      reply_to_email: data.pending_reply_to_email,
      reply_to_verified_at: new Date().toISOString(),
      pending_reply_to_email: null,
      reply_to_verification_hash: null,
      reply_to_verification_expires_at: null,
    })
    .eq("organization_id", organizationId);
  return Response.redirect(
    new URL(
      `/admin/settings/email-receipts?organization=${organizationId}&verified=1`,
      url.origin,
    ),
  );
}
