import { QuoteRequestDto } from './quote.dto';
import { QuoteService } from './quote.service';
export declare class QuoteController {
    private quoteService;
    constructor(quoteService: QuoteService);
    quote(req: {
        partner: {
            partnerCode: string;
        };
        headers: Record<string, string>;
    }, body: QuoteRequestDto, idem?: string): Promise<{
        replay: boolean;
        quote_id: string;
        expires_at: Date;
        premium_total: number;
        sum_insured_total: number;
        disclosures: any;
        offers: {
            product_code: string;
            product_name: string;
            segment: import(".prisma/client").$Enums.ProductSegment;
        }[];
    }>;
}
