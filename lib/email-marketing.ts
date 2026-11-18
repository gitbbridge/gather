export type AudienceRule = {
  id: string;
  field: "event_type" | "event_season" | "event_attendance" | "supporter_status" | "donation_history" | "tag" | "travel_interest" | "last_contribution" | "marketing_permission";
  operator: "is" | "is_not" | "contains" | "greater_than" | "after";
  value: string;
};

export type CampaignBlock = {
  id: string;
  type: "heading" | "text" | "image" | "button" | "divider" | "spacer";
  content?: string;
  href?: string;
  alt?: string;
};

export type MarketingContact = {
  id: string;
  tags?: string[] | null;
  last_activity_at?: string | null;
  supporter_activities?: Array<{ activity_type?: string; occurred_at?: string; metadata?: Record<string, unknown> | null }> | null;
};

export type MarketingPreference = {
  supporter_id: string;
  marketing_status: "unknown" | "subscribed" | "unsubscribed" | "complained";
  validation_status: "not_checked" | "deliverable" | "risky" | "unknown" | "undeliverable";
  suppressed_at?: string | null;
};

export function contactCanReceiveMarketing(preference?: MarketingPreference | null) {
  if (!preference) return false;
  return preference.marketing_status === "subscribed" && !preference.suppressed_at && !["undeliverable"].includes(preference.validation_status);
}

export function contactMatchesRules(contact: MarketingContact, preference: MarketingPreference | null | undefined, rules: AudienceRule[], match: "and" | "or" = "and") {
  if (!rules.length) return true;
  const activities = contact.supporter_activities || [];
  const results = rules.map((rule) => {
    let values: string[] = [];
    if (rule.field === "tag") values = contact.tags || [];
    if (rule.field === "marketing_permission") values = [preference?.marketing_status || "unknown"];
    if (rule.field === "last_contribution") values = activities.filter((item) => ["payment_completed", "historical_contribution"].includes(item.activity_type || "")).map((item) => item.occurred_at || "").filter(Boolean);
    if (rule.field === "donation_history") values = activities.filter((item) => ["payment_completed", "historical_contribution"].includes(item.activity_type || "")).map((item) => String(item.metadata?.amount || "contributed"));
    if (rule.field === "event_attendance") values = activities.filter((item) => item.activity_type === "event_attended").map(() => "attended");
    if (rule.field === "supporter_status") values = activities.map((item) => item.activity_type || "");
    if (rule.field === "travel_interest") values = activities.filter((item) => ["travel_package_selected", "direct_offer_purchased"].includes(item.activity_type || "")).map(() => "travel");
    if (rule.field === "event_type" || rule.field === "event_season") values = activities.map((item) => String(item.metadata?.[rule.field] || "")).filter(Boolean);
    const expected = rule.value.trim().toLowerCase();
    const normalized = values.map((value) => value.toLowerCase());
    if (rule.operator === "is") return normalized.includes(expected);
    if (rule.operator === "is_not") return !normalized.includes(expected);
    if (rule.operator === "contains") return normalized.some((value) => value.includes(expected));
    if (rule.operator === "after") return values.some((value) => Date.parse(value) > Date.parse(rule.value));
    if (rule.operator === "greater_than") return values.some((value) => Number(value) > Number(rule.value));
    return false;
  });
  return match === "and" ? results.every(Boolean) : results.some(Boolean);
}

export function eligibleAudience(contacts: MarketingContact[], preferences: MarketingPreference[], rules: AudienceRule[], match: "and" | "or" = "and") {
  const bySupporter = new Map(preferences.map((item) => [item.supporter_id, item]));
  return contacts.filter((contact) => {
    const preference = bySupporter.get(contact.id);
    return contactCanReceiveMarketing(preference) && contactMatchesRules(contact, preference, rules, match);
  });
}

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const safeHref = (value: string) => /^https:\/\//i.test(value) ? value : "#";

export function renderCampaignHtml(blocks: CampaignBlock[], unsubscribeUrl: string) {
  const content = blocks.map((block) => {
    if (block.type === "heading") return `<h2 style="color:#123d31;font-size:28px;line-height:1.2;margin:0 0 18px">${escapeHtml(block.content || "")}</h2>`;
    if (block.type === "text") return `<p style="color:#36584d;font-size:16px;line-height:1.65;margin:0 0 18px">${escapeHtml(block.content || "").replaceAll("\n", "<br>")}</p>`;
    if (block.type === "image") return `<img src="${escapeHtml(safeHref(block.href || ""))}" alt="${escapeHtml(block.alt || "")}" style="display:block;width:100%;height:auto;border-radius:12px;margin:0 0 18px">`;
    if (block.type === "button") return `<p style="margin:0 0 22px"><a href="${escapeHtml(safeHref(block.href || ""))}" style="display:inline-block;background:#175b47;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:9px">${escapeHtml(block.content || "Learn more")}</a></p>`;
    if (block.type === "divider") return `<hr style="border:0;border-top:1px solid #dce6e1;margin:24px 0">`;
    return `<div style="height:24px;line-height:24px">&nbsp;</div>`;
  }).join("");
  return `<!doctype html><html><body style="margin:0;background:#f5f8f6;font-family:Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:28px 18px"><div style="background:#fff;border:1px solid #dce6e1;border-radius:16px;padding:30px"><p style="color:#175b47;font-size:22px;font-weight:800;margin:0 0 28px">gather.</p>${content}<p style="border-top:1px solid #dce6e1;color:#6d807a;font-size:12px;line-height:1.5;margin:28px 0 0;padding-top:18px">You are receiving this message because you opted in to updates from this organization. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#175b47">Unsubscribe</a>.</p></div></div></body></html>`;
}

export function aggregateCampaignMetrics(campaigns: Array<{ delivered_count?: number | null; open_count?: number | null; click_count?: number | null; unsubscribe_count?: number | null; attributed_amount_cents?: number | null }>) {
  const delivered = campaigns.reduce((sum, item) => sum + Number(item.delivered_count || 0), 0);
  const opens = campaigns.reduce((sum, item) => sum + Number(item.open_count || 0), 0);
  const clicks = campaigns.reduce((sum, item) => sum + Number(item.click_count || 0), 0);
  const unsubscribes = campaigns.reduce((sum, item) => sum + Number(item.unsubscribe_count || 0), 0);
  return { delivered, openRate: delivered ? opens / delivered : 0, clickRate: delivered ? clicks / delivered : 0, unsubscribeRate: delivered ? unsubscribes / delivered : 0, attributedAmountCents: campaigns.reduce((sum, item) => sum + Number(item.attributed_amount_cents || 0), 0) };
}
