import { PrismaService } from '../../prisma/prisma.service';
import { AuditAppend } from './audit.types';
export declare class AuditService {
    private prisma;
    constructor(prisma: PrismaService);
    append(evt: AuditAppend): Promise<{
        eventHash: string;
    }>;
}
