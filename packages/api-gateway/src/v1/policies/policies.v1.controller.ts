import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { PartnerAuthGuard } from '../../common/auth/auth.guard';
import { CreatePolicyV1RequestDto, PaymentModeV1 } from './policies.v1.dto';
import { PoliciesV1Service } from './policies.v1.service';

@ApiTags('policies-v1')
@Controller('/api/v1')
export class PoliciesV1Controller {
  constructor(private policies: PoliciesV1Service) {}

  @Post('/policies')
  @UseGuards(PartnerAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async createPolicy(
    @Req() req: { partner: { partnerCode: string }; headers: Record<string, string> },
    @Body() body: CreatePolicyV1RequestDto,
    @Headers('idempotency-key') idem?: string,
  ) {
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
    const isPendingPayment = body.payment.mode === PaymentModeV1.SAFECOVER_COLLECT;

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

  @Get('/policies/:policy_id')
  @UseGuards(PartnerAuthGuard)
  @ApiBearerAuth()
  async getPolicy(
    @Req() req: { partner: { partnerCode: string } },
    @Param('policy_id') policyId: string,
  ) {
    const p = await this.policies.getPolicyByNumber(req.partner.partnerCode, policyId);
    if (!p) return { error: 'Not found', code: 'NOT_FOUND' };

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

  @Get('/policies/:policy_id/certificate')
  async certificate(@Param('policy_id') policyId: string, @Res() res: any) {
    // Minimal placeholder: in MVP this can redirect to a hosted HTML certificate page.
    // Keep API stable so frontend/backoffice can add a real artifact later.
    return res.status(404).json({ code: 'NOT_FOUND', message: `No certificate for policy ${policyId}` });
  }
}

