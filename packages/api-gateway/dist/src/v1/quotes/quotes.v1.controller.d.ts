import { CreateQuoteV1RequestDto } from './quotes.v1.dto';
import { QuotesV1Service } from './quotes.v1.service';
export declare class QuotesV1Controller {
    private quotes;
    constructor(quotes: QuotesV1Service);
    createQuote(req: {
        partner: {
            partnerCode: string;
        };
        headers: Record<string, string>;
    }, body: CreateQuoteV1RequestDto, idem?: string): Promise<{
        replay: boolean;
        quote: {
            quote_id: string;
            status: string;
            created_at: Date;
            expires_at: Date;
            store_id: string;
            transaction_id: string;
            channel: import(".prisma/client").$Enums.Channel;
            jurisdiction: string | null;
            currency: string;
            product_code: string;
            sum_insured_total: number;
            premium_total_min: number;
            premium_total_max: number;
            disclosures: import("@prisma/client/runtime/library").JsonValue;
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
            selected_offer_id: null;
        };
    }>;
    getQuote(req: {
        partner: {
            partnerCode: string;
        };
    }, quoteId: string): Promise<{
        error: string;
        code: string;
        quote?: undefined;
    } | {
        quote: {
            quote_id: string;
            status: string;
            created_at: Date;
            expires_at: Date;
            transaction_id: string;
            channel: import(".prisma/client").$Enums.Channel;
            currency: string;
            product_code: string;
            sum_insured_total: number;
            premium_total_min: number;
            premium_total_max: number;
            disclosures: import("@prisma/client/runtime/library").JsonValue;
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
            selected_offer_id: null;
        };
        error?: undefined;
        code?: undefined;
    }>;
    selectOffer(quoteId: string, offerId: string): Promise<{
        quote_id: string;
        selected_offer_id: string;
    }>;
}
