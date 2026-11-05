import { z } from "zod";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashPortalToken, randomPortalToken } from "@/lib/sponsors";

export const dynamic = "force-dynamic";
const input = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const parsed = input.safeParse(await request.json());
    if (!parsed.success)
      return Response.json({ error: "This invitation link is invalid." }, { status: 400 });
    const client = createSupabaseAdminClient();
    const tokenHash = await hashPortalToken(parsed.data.token);
    const { data: invitation, error } = await client
      .from("fee_sponsorship_invitations")
      .select("id,status,expires_at,exchanged_at,revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw error;
    if (!invitation || invitation.revoked_at || invitation.status === "revoked")
      return Response.json({ error: "This invitation is no longer available." }, { status: 410 });
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await client.from("fee_sponsorship_invitations").update({ status: "expired" }).eq("id", invitation.id);
      return Response.json({ error: "This invitation has expired. Ask the nonprofit to resend it." }, { status: 410 });
    }
    if (invitation.exchanged_at)
      return Response.json({ error: "This invitation link was already used. Ask the nonprofit to resend secure access." }, { status: 409 });
    const rawSession = randomPortalToken();
    const sessionHash = await hashPortalToken(rawSession);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const { error: sessionError } = await client.from("sponsor_portal_sessions").insert({
      invitation_id: invitation.id,
      session_token_hash: sessionHash,
      expires_at: expiresAt,
    });
    if (sessionError) throw sessionError;
    await client.from("fee_sponsorship_invitations").update({ exchanged_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", invitation.id);
    (await cookies()).set("gather_sponsor_portal", rawSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/sponsor",
      expires: new Date(expiresAt),
    });
    return Response.json({ ok: true, redirect: "/sponsor/portal" });
  } catch (error) {
    console.error("Unable to exchange sponsor invitation:", error);
    return Response.json({ error: "Unable to open this sponsorship invitation." }, { status: 500 });
  }
}
