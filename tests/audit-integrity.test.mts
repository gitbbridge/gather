import test from 'node:test';
import assert from 'node:assert/strict';
import { auditIntegrityHash, canonicalAuditEvent, publicAuditState, type AuditEventPayload } from '../lib/audit-integrity.ts';

const event: AuditEventPayload = {
  id: 'event-1', organizationId: 'org-1', auctionId: 'auction-1', recordType: 'payment',
  recordId: 'payment-1', action: 'confirmed', actorId: 'stripe', actorRole: 'service',
  previousState: { status: 'pending' }, newState: { status: 'paid', amountCents: 10000 },
  reason: null, authorizationReference: 'pi_123', sourceSystem: 'stripe', correlationId: 'pi_123',
  previousIntegrityHash: null, createdAt: 1_800_000_000_000,
};

test('canonical audit events are stable regardless of object key order', () => {
  const reordered = { ...event, newState: { amountCents: 10000, status: 'paid' } };
  assert.equal(canonicalAuditEvent(event), canonicalAuditEvent(reordered));
});

test('audit hashes change when protected history is altered', async () => {
  const original = await auditIntegrityHash(event);
  const changed = await auditIntegrityHash({ ...event, newState: { status: 'paid', amountCents: 9999 } });
  assert.notEqual(original, changed);
  assert.match(original, /^[a-f0-9]{64}$/);
});

test('ordinary audit views redact private maximum bids', () => {
  assert.deepEqual(publicAuditState('bid', { currentBidCents: 5000, maximumAmountCents: 10000 }), { currentBidCents: 5000 });
});
