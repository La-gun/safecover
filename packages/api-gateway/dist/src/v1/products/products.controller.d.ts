import { PrismaService } from '../../prisma/prisma.service';
export declare class ProductsV1Controller {
    private prisma;
    constructor(prisma: PrismaService);
    listProducts(): Promise<{
        products: {
            product_code: string;
            name: string;
            segment: import(".prisma/client").$Enums.ProductSegment;
            is_active: boolean;
            currency: string;
            sum_insured_cap: number;
            disclosures: {
                plain_language_summary_md: string;
                cooling_off_days: number;
                key_rules: import("@prisma/client/runtime/library").JsonValue;
            };
            quote_ttl_seconds: number;
            jurisdictions: never[];
        }[];
    }>;
    listJurisdictions(): Promise<{
        supported: string[];
        default: string;
    }>;
}
