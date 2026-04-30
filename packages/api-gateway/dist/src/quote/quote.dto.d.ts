declare class QuoteItemDto {
    sku: string;
    price: number;
    serial: string;
    category: string;
}
export declare class QuoteRequestDto {
    store_id: string;
    transaction_id: string;
    timestamp: string;
    customer_id?: string;
    items: QuoteItemDto[];
    channel: 'POS' | 'WEB' | 'APP' | 'USSD';
    product_code?: string;
}
export {};
