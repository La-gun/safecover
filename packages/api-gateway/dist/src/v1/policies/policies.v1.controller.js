"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoliciesV1Controller = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/auth/auth.guard");
const policies_v1_dto_1 = require("./policies.v1.dto");
const policies_v1_service_1 = require("./policies.v1.service");
let PoliciesV1Controller = class PoliciesV1Controller {
    constructor(policies) {
        this.policies = policies;
    }
    async createPolicy(req, body, idem) {
        const correlationId = req.headers['x-correlation-id'];
        const result = await this.policies.createPolicy({
            partnerCode: req.partner.partnerCode,
            idempotencyKey: idem,
            quoteCode: body.quote_id,
            offerId: body.offer_id,
            payment: body.payment,
            correlationId,
        });
        const p = result.policy;
        const isPendingPayment = body.payment.mode === policies_v1_dto_1.PaymentModeV1.SAFECOVER_COLLECT;
        return {
            replay: result.replay,
            policy: {
                policy_id: p.policyNumber,
                status: isPendingPayment ? 'PENDING_PAYMENT' : 'ACTIVE',
                issued_at: p.issuedAt,
                quote_id: body.quote_id,
                offer_id: body.offer_id,
                provider_id: 'safecover',
                plan_id: body.offer_id,
                premium_total: p.premiumTotal,
                currency: body.payment.currency ?? p.productModule.currency,
                coverage: {
                    sum_insured_total: p.sumInsuredTotal,
                    starts_at: p.startsAt,
                    ends_at: p.endsAt,
                    cooling_off_ends_at: p.coolingOffEndsAt,
                },
                certificate: p.certificateUrl
                    ? { url: p.certificateUrl, format: 'HTML' }
                    : { url: `/api/v1/policies/${p.policyNumber}/certificate`, format: 'HTML' },
            },
            polling: isPendingPayment
                ? { status_url: `/api/v1/policies/${p.policyNumber}`, recommended_poll_seconds: 2 }
                : undefined,
            payment_session: isPendingPayment
                ? { url: 'https://example.invalid/pay', provider: 'safecover' }
                : undefined,
        };
    }
    async getPolicy(req, policyId) {
        const p = await this.policies.getPolicyByNumber(req.partner.partnerCode, policyId);
        if (!p)
            return { error: 'Not found', code: 'NOT_FOUND' };
        return {
            policy: {
                policy_id: p.policyNumber,
                status: p.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_ISSUANCE',
                issued_at: p.issuedAt,
                premium_total: p.premiumTotal,
                sum_insured_total: p.sumInsuredTotal,
                certificate: p.certificateUrl ? { url: p.certificateUrl, format: 'HTML' } : null,
            },
        };
    }
    async certificate(policyId, res) {
        return res.status(404).json({ code: 'NOT_FOUND', message: `No certificate for policy ${policyId}` });
    }
};
exports.PoliciesV1Controller = PoliciesV1Controller;
__decorate([
    (0, common_1.Post)('/policies'),
    (0, common_1.UseGuards)(auth_guard_1.PartnerAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: false }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, policies_v1_dto_1.CreatePolicyV1RequestDto, String]),
    __metadata("design:returntype", Promise)
], PoliciesV1Controller.prototype, "createPolicy", null);
__decorate([
    (0, common_1.Get)('/policies/:policy_id'),
    (0, common_1.UseGuards)(auth_guard_1.PartnerAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('policy_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PoliciesV1Controller.prototype, "getPolicy", null);
__decorate([
    (0, common_1.Get)('/policies/:policy_id/certificate'),
    __param(0, (0, common_1.Param)('policy_id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PoliciesV1Controller.prototype, "certificate", null);
exports.PoliciesV1Controller = PoliciesV1Controller = __decorate([
    (0, swagger_1.ApiTags)('policies-v1'),
    (0, common_1.Controller)('/api/v1'),
    __metadata("design:paramtypes", [policies_v1_service_1.PoliciesV1Service])
], PoliciesV1Controller);
//# sourceMappingURL=policies.v1.controller.js.map