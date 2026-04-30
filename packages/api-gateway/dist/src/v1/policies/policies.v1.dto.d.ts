export declare enum PaymentModeV1 {
    PLATFORM_COLLECTED = "PLATFORM_COLLECTED",
    SAFECOVER_COLLECT = "SAFECOVER_COLLECT"
}
declare class PaymentDto {
    mode: PaymentModeV1;
    transaction_id?: string;
    amount_paid?: number;
    currency?: string;
    processor?: string;
    payment_reference?: string;
}
declare class CustomerDto {
    email?: string;
    name?: string;
    phone?: string;
    customer_id?: string;
}
export declare class CreatePolicyV1RequestDto {
    quote_id: string;
    offer_id: string;
    payment: PaymentDto;
    customer?: CustomerDto;
    return_url?: string;
    metadata?: Record<string, unknown>;
}
export {};
