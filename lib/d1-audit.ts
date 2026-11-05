import type { D1Database } from '@cloudflare/workers-types';
import { auditIntegrityHash, type AuditEventPayload } from './audit-integrity';

export type RecordAuditEventInput = Omit<AuditEventPayload, 'id' | 'createdAt' | 'previousIntegrityHash'> & {
  id?: string;
  createdAt?: number;
};

export async function recordD1AuditEvent(database: D1Database, input: RecordAuditEventInput) {
  const id = input.id ?? crypto.randomUUID();
  const createdAt = input.createdAt ?? Date.now();
  const predecessor = await database.prepare(
    'SELECT integrity_hash AS integrityHash FROM audit_events WHERE auction_id IS ? ORDER BY created_at DESC, id DESC LIMIT 1',
  ).bind(input.auctionId).first<{ integrityHash: string }>();

  const payload: AuditEventPayload = {
    ...input,
    id,
    createdAt,
    previousIntegrityHash: predecessor?.integrityHash ?? null,
  };
  const integrityHash = await auditIntegrityHash(payload);

  await database.prepare(`INSERT INTO audit_events (
    id,organization_id,auction_id,record_type,record_id,action,actor_id,actor_role,
    previous_state,new_state,reason,authorization_reference,source_system,correlation_id,
    previous_integrity_hash,integrity_hash,created_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    payload.id,
    payload.organizationId,
    payload.auctionId,
    payload.recordType,
    payload.recordId,
    payload.action,
    payload.actorId,
    payload.actorRole,
    payload.previousState == null ? null : JSON.stringify(payload.previousState),
    payload.newState == null ? null : JSON.stringify(payload.newState),
    payload.reason,
    payload.authorizationReference,
    payload.sourceSystem,
    payload.correlationId,
    payload.previousIntegrityHash,
    integrityHash,
    payload.createdAt,
  ).run();

  return { id, integrityHash, previousIntegrityHash: payload.previousIntegrityHash, createdAt };
}
