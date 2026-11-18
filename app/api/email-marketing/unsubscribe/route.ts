import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/email-unsubscribe";

export const dynamic = "force-dynamic";

function page(title: string, copy: string, status = 200) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="margin:0;background:#f5f8f6;font-family:Arial,sans-serif;color:#173f34"><main style="max-width:560px;margin:10vh auto;background:#fff;border:1px solid #dce6e1;border-radius:18px;padding:36px"><p style="color:#17634c;font-size:24px;font-weight:800">gather.</p><h1>${title}</h1><p style="font-size:16px;line-height:1.6;color:#526a61">${copy}</p></main></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    const payload = await verifyUnsubscribeToken(token);
    if (!payload) return page("This link is not valid", "The unsubscribe link may be incomplete or expired. Contact the organization if you still need help.", 400);
    const client = createSupabaseAdminClient();
    const { error } = await client.from("marketing_contact_preferences").upsert({ organization_id: payload.organizationId, supporter_id: payload.supporterId, marketing_status: "unsubscribed", suppression_reason: "recipient_unsubscribe", suppressed_at: new Date().toISOString(), consent_updated_at: new Date().toISOString(), consent_source: "campaign_unsubscribe" }, { onConflict: "organization_id,supporter_id" });
    if (error) throw error;
    await client.from("email_campaign_events").insert({ organization_id: payload.organizationId, campaign_id: payload.campaignId, supporter_id: payload.supporterId, event_type: "unsubscribe", metadata: { source: "signed_unsubscribe_link" } });
    return page("You are unsubscribed", "You will no longer receive marketing emails from this organization. Transactional messages about your account, bids, payments, or receipts are separate.");
  } catch (error) {
    console.error("Unable to process email unsubscribe:", error);
    return page("We could not update your preference", "Please try again or contact the organization for help.", 500);
  }
}
