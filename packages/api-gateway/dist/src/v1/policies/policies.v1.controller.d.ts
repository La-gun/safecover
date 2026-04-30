import { CreatePolicyV1RequestDto } from './policies.v1.dto';
import { PoliciesV1Service } from './policies.v1.service';
export declare class PoliciesV1Controller {
    private policies;
    constructor(policies: PoliciesV1Service);
    createPolicy(req: {
        partner: {
            partnerCode: string;
        };
        headers: Record<string, string>;
    }, body: CreatePolicyV1RequestDto, idem?: string): Promise<{
        replay: boolean;
        policy: {
            policy_id: string;
            status: string;
            issued_at: Date;
            quote_id: string;
            offer_id: string;
            provider_id: string;
            plan_id: string;
            premium_total: number;
            currency: string;
            coverage: {
                sum_insured_total: number;
                starts_at: Date;
                ends_at: Date;
                cooling_off_ends_at: Date;
            };
            certificate: {
                url: string;
                format: string;
            };
        };
        polling: {
            status_url: string;
            recommended_poll_seconds: number;
        } | undefined;
        payment_session: {
            url: string;
            provider: string;
        } | undefined;
    }>;
    getPolicy(req: {
        partner: {
            partnerCode: string;
        };
    }, policyId: string): Promise<{
        error: string;
        code: string;
        policy?: undefined;
    } | {
        policy: {
            policy_id: string;
            status: string;
            issued_at: Date;
            premium_total: number;
            sum_insured_total: number;
            certificate: {
                url: string;
                format: string;
            } | null;
        };
        error?: undefined;
        code?: undefined;
    }>;
    certificate(policyId: string, res: any): Promise<any>;
}
