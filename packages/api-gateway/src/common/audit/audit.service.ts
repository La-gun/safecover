import crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAppend } from './audit.types';

function hashEvent(input: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async append(evt: AuditAppend): Promise<{ eventHash: string }> {
    const [prev] = await this.prisma.auditEvent.findMany({
      where: { entityType: evt.entityType, entityId: evt.entityId },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { eventHash: true },
    });

    const base = {
      ...evt,
      prevHash: prev?.eventHash ?? null,
      createdAt: new Date().toISOString(),
    };
    const eventHash = hashEvent(base);

    await this.prisma.auditEvent.create({
      data: {
        actorType: evt.actorType,
        actorId: evt.actorId,
        partnerCode: evt.partnerCode,
        entityType: evt.entityType,
        entityId: evt.entityId,
        eventType: evt.eventType,
        correlationId: evt.correlationId,
        payload: JSON.stringify(evt.payload),
        prevHash: prev?.eventHash ?? null,
        eventHash,
      },
    });

    return { eventHash };
  }
}
