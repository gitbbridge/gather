export type AuditEventPayload = {
  id: string;
  organizationId: string | null;
  auctionId: string | null;
  recordType: string;
  recordId: string;
  action: string;
  actorId: string;
  actorRole: string;
  previousState: unknown;
  newState: unknown;
  reason: string | null;
  authorizationReference: string | null;
  sourceSystem: string;
  correlationId: string;
  previousIntegrityHash: string | null;
  createdAt: number;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function canonicalAuditEvent(payload: AuditEventPayload) {
  return JSON.stringify(canonicalize(payload));
}

export async function auditIntegrityHash(payload: AuditEventPayload) {
  const bytes = new TextEncoder().encode(canonicalAuditEvent(payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function publicAuditState(recordType: string, state: unknown) {
  if (!state || typeof state !== 'object') return state;
  const copy = structuredClone(state) as Record<string, unknown>;
  // Maximum/proxy bids are protected even from ordinary organizer exports.
  if (recordType === 'bid') {
    delete copy.maximumAmountCents;
    delete copy.maximumBid;
  }
  return copy;
}
