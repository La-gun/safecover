export type AuditAppend = {
  actorType: 'PARTNER' | 'ADMIN' | 'SYSTEM';
  actorId?: string;
  partnerCode?: string;
  entityType: string;
  entityId: string;
  eventType: string;
  correlationId?: string;
  payload: unknown;
};
