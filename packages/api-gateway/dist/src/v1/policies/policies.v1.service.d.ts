import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaymentModeV1 } from './policies.v1.dto';
export declare class PoliciesV1Service {
    private prisma;
    private audit;
    constructor(prisma: PrismaService, audit: AuditService);
    private paymentRefFromIdempotency;
    createPolicy(input: {
        partnerCode: string;
        idempotencyKey?: string;
        quoteCode: string;
        offerId: string;
        payment: {
            mode: PaymentModeV1;
            transaction_id?: string;
            amount_paid?: number;
            currency?: string;
            processor?: string;
            payment_reference?: string;
        };
        correlationId?: string;
    }): Promise<{
        replay: boolean;
        policy: {
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
        } & {
            id: string;
            createdAt: Date;
            partnerId: string;
            storeId: string;
            fraudScore: number;
            customerId: string | null;
            productModuleId: string;
            status: import(".prisma/client").$Enums.PolicyStatus;
            premiumTotal: number;
            sumInsuredTotal: number;
            policyNumber: string;
            quoteId: string | null;
            paymentRef: string;
            certificateUrl: string | null;
            issuedAt: Date;
            startsAt: Date;
            endsAt: Date;
            coolingOffEndsAt: Date;
            fraudDecision: import(".prisma/client").$Enums.FraudDecision;
        };
        async: boolean;
    }>;
    getPolicyByNumber(partnerCode: string, policyNumber: string): Promise<({
        partner: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        partnerId: string;
        storeId: string;
        fraudScore: number;
        customerId: string | null;
        productModuleId: string;
        status: import(".prisma/client").$Enums.PolicyStatus;
        premiumTotal: number;
        sumInsuredTotal: number;
        policyNumber: string;
        quoteId: string | null;
        paymentRef: string;
        certificateUrl: string | null;
        issuedAt: Date;
        startsAt: Date;
        endsAt: Date;
        coolingOffEndsAt: Date;
        fraudDecision: import(".prisma/client").$Enums.FraudDecision;
    }) | null>;
}
