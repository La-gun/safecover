import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { ProductConfigService } from '../product-config/product-config.service';
import { QuoteRequestDto } from './quote.dto';
export declare class QuoteService {
    private prisma;
    private audit;
    private productConfig;
    constructor(prisma: PrismaService, audit: AuditService, productConfig: ProductConfigService);
    createQuote(partnerCode: string, idempotencyKey: string | undefined, body: QuoteRequestDto, correlationId?: string): Promise<{
        replay: boolean;
        quote: {
            productModule: {
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
                rulesJson: Prisma.JsonValue;
                reinsuranceTags: string[];
            };
            items: {
                id: string;
                quoteId: string;
                sku: string;
                price: number;
                category: string;
                serialHash: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            partnerId: string;
            storeId: string;
            quoteCode: string;
            customerId: string | null;
            productModuleId: string;
            transactionId: string;
            channel: import(".prisma/client").$Enums.Channel;
            timestamp: Date;
            status: import(".prisma/client").$Enums.QuoteStatus;
            premiumTotal: number;
            sumInsuredTotal: number;
            disclosures: Prisma.JsonValue;
            idempotencyKey: string | null;
            expiresAt: Date;
        };
    }>;
}
