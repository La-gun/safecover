import { Prisma, ProductSegment } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductConfigService } from '../../product-config/product-config.service';
import { CreateQuoteV1RequestDto, QuoteModeV1 } from './quotes.v1.dto';
export declare class QuotesV1Service {
    private prisma;
    private audit;
    private productConfig;
    constructor(prisma: PrismaService, audit: AuditService, productConfig: ProductConfigService);
    createQuote(partnerCode: string, idempotencyKey: string | undefined, body: CreateQuoteV1RequestDto, correlationId?: string): Promise<{
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
        mode: QuoteModeV1;
    }>;
    buildOffers(input: {
        quoteCode: string;
        productCode: string;
        productName: string;
        segment: ProductSegment;
        premiumBase: number;
        sumInsuredTotal: number;
        mode: QuoteModeV1;
    }): {
        offers: {
            offer_id: string;
            provider: {
                provider_id: string;
                name: string;
                logo: string;
                tagline: string;
            };
            plan: {
                plan_id: string;
                name: string;
                summary: string;
                benefits: never[];
                terms_url: string;
            };
            pricing: {
                premium_total: number;
                commission_total: number;
                tax_total: number;
            };
            coverage: {
                type: string;
                sum_insured_total: number;
                duration: string;
                excess: number;
            };
            underwriting: {
                decision: string;
                requires_async_issue: boolean;
            };
        }[];
        recommended_offer_id: string;
    };
    getQuoteByCode(partnerCode: string, quoteCode: string): Promise<({
        partner: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
        };
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
    }) | null>;
}
