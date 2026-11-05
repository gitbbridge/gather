export type LiveSessionStatus = "not_started" | "ready" | "active" | "paused" | "ended";
export type LiveRole = "event_director" | "checkin_volunteer" | "auction_clerk" | "pledge_recorder" | "checkout_staff" | "screen_operator";

const transitions: Record<LiveSessionStatus, LiveSessionStatus[]> = {
  not_started: ["ready"], ready: ["active"], active: ["paused", "ended"], paused: ["active", "ended"], ended: [],
};

export function canTransitionLiveSession(from: LiveSessionStatus, to: LiveSessionStatus) {
  return transitions[from].includes(to);
}

export function nextLiveBid(currentCents: number, openingCents: number, incrementCents: number) {
  return currentCents > 0 ? currentCents + incrementCents : openingCents;
}

export function liveRoleCan(role: LiveRole, action: string) {
  if (role === "event_director") return true;
  const allowed: Record<LiveRole, string[]> = {
    event_director: [],
    checkin_volunteer: ["assign_paddle"],
    auction_clerk: ["open_lot", "record_bid", "finalize_lot"],
    pledge_recorder: ["record_pledge"],
    checkout_staff: [],
    screen_operator: ["projector"],
  };
  return allowed[role].includes(action);
}

export function pledgeTotals(rows: { amount_cents: number; status: string }[]) {
  return rows.reduce((total, row) => {
    if (!["cancelled", "refunded"].includes(row.status)) total.pledged += row.amount_cents;
    if (["paid", "partially_refunded"].includes(row.status)) total.collected += row.amount_cents;
    return total;
  }, { pledged: 0, collected: 0 });
}
