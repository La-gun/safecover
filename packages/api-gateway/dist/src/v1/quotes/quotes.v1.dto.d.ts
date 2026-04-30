export declare enum QuoteModeV1 {
    SINGLE = "SINGLE",
    RATE = "RATE",
    COMPARE = "COMPARE"
}
export declare enum ChannelV1 {
    POS = "POS",
    WEB = "WEB",
    APP = "APP",
    USSD = "USSD"
}
declare class CustomerDto {
    customer_id?: string;
    email?: string;
    name?: string;
    phone?: string;
}
declare class QuoteItemV1Dto {
    sku: string;
    name?: string;
    category?: string;
    quantity: number;
    unit_price?: number;
    declared_value?: number;
    serial?: string;
}
export declare class CreateQuoteV1RequestDto {
    store_id: string;
    transaction_id: string;
    timestamp: string;
    channel: ChannelV1;
    jurisdiction?: string;
    currency?: string;
    mode?: QuoteModeV1;
    product_code?: string;
    customer?: CustomerDto;
    items: QuoteItemV1Dto[];
    risk_data?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}
export {};
