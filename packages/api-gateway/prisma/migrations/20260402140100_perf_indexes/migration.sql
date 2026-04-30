-- Idempotent quote lookup (partner + idempotency + transaction)
CREATE INDEX IF NOT EXISTS "Quote_partnerId_idempotencyKey_transactionId_idx" ON "Quote" ("partnerId", "idempotencyKey", "transactionId");

-- Audit chain tail: entityType + entityId + createdAt ordering
CREATE INDEX IF NOT EXISTS "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent" ("entityType", "entityId", "createdAt");
