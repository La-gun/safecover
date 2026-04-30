import { PrismaService } from '../prisma/prisma.service';
export declare class ProductConfigService {
    private prisma;
    constructor(prisma: PrismaService);
    getByCode(code: string): Promise<{
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        segment: import(".prisma/client").$Enums.ProductSegment;
        currency: string;
        sumInsuredCap: number;
        coolingOffDays: number;
        disclosureMd: string;
        rulesJson: import("@prisma/client/runtime/library").JsonValue;
        reinsuranceTags: string[];
    }>;
    enforceDefaultCaps(segment: string, sumInsuredTotal: number, cap: number): {
        allowed: true;
    } | {
        allowed: false;
        reason: string;
    };
}
