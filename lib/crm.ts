export type CrmActivity = { activity_type: string; amount_cents: number | null; occurred_at: string; auction_id?: string | null };
export type CrmContactInput = { id: string; roles?: string[] | null; tags?: string[] | null; status?: string | null; supporter_activities?: CrmActivity[] | null };

const giftTypes = new Set(["payment_completed", "historical_contribution"]);
const refundTypes = new Set(["payment_refunded", "payment_partially_refunded"]);

export function contactFinancialSummary(activities: CrmActivity[], now = new Date()) {
  const gifts = activities.filter((item) => giftTypes.has(item.activity_type));
  const refunds = activities.filter((item) => refundTypes.has(item.activity_type));
  const lifetimeGross = gifts.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  const refunded = refunds.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  const year = now.getUTCFullYear();
  const ytdGivingCents = gifts.filter((item) => new Date(item.occurred_at).getUTCFullYear() === year).reduce((sum, item) => sum + Number(item.amount_cents || 0), 0)
    - refunds.filter((item) => new Date(item.occurred_at).getUTCFullYear() === year).reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  const sorted = [...gifts].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
  return {
    lifetimeGivingCents: Math.max(0, lifetimeGross - refunded),
    ytdGivingCents: Math.max(0, ytdGivingCents),
    largestGiftCents: gifts.reduce((largest, item) => Math.max(largest, Number(item.amount_cents || 0)), 0),
    lastGiftAt: sorted[0]?.occurred_at || null,
    lastGiftCents: Number(sorted[0]?.amount_cents || 0),
  };
}

export function derivedRoles(contact: CrmContactInput) {
  const roles = new Set((contact.roles || []).map((value) => value.toLowerCase()));
  const activities = contact.supporter_activities || [];
  if (activities.some((item) => ["payment_completed", "historical_contribution"].includes(item.activity_type))) roles.add("donor");
  if (activities.some((item) => ["bid_placed", "item_won"].includes(item.activity_type))) roles.add("bidder");
  if (activities.some((item) => ["ticket_purchased", "event_attended"].includes(item.activity_type))) roles.add("event_attendee");
  if ((contact.tags || []).some((tag) => tag.toLowerCase().includes("sponsor"))) roles.add("sponsor");
  return [...roles].sort();
}

export function donorLifecycle(activities: CrmActivity[], lapsedAfterMonths = 12, now = new Date()) {
  const lastGift = activities.filter((item) => giftTypes.has(item.activity_type)).sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))[0];
  if (!lastGift) return "prospect" as const;
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - lapsedAfterMonths);
  return new Date(lastGift.occurred_at) < cutoff ? "lapsed" as const : "active" as const;
}

export function retentionMetrics(contacts: CrmContactInput[], now = new Date()) {
  const currentYear = now.getUTCFullYear();
  const priorYear = currentYear - 1;
  const gaveIn = (contact: CrmContactInput, year: number) => (contact.supporter_activities || []).some((item) => giftTypes.has(item.activity_type) && new Date(item.occurred_at).getUTCFullYear() === year);
  const priorDonors = contacts.filter((contact) => gaveIn(contact, priorYear));
  const retained = priorDonors.filter((contact) => gaveIn(contact, currentYear));
  return { priorYearDonors: priorDonors.length, retainedDonors: retained.length, retentionRate: priorDonors.length ? retained.length / priorDonors.length : 0 };
}
