import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { PartnerAuthGuard } from '../common/auth/auth.guard';
import { QuoteRequestDto } from './quote.dto';
import { QuoteService } from './quote.service';

@ApiTags('quote')
@Controller('/api')
export class QuoteController {
  constructor(private quoteService: QuoteService) {}

  @Post('/quote')
  @UseGuards(PartnerAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async quote(
    @Req() req: { partner: { partnerCode: string }; headers: Record<string, string> },
    @Body() body: QuoteRequestDto,
    @Headers('idempotency-key') idem?: string,
  ) {
    const correlationId = req.headers['x-correlation-id'];
    const result = await this.quoteService.createQuote(
      req.partner.partnerCode,
      idem,
      body,
      correlationId,
    );
    const q = result.quote;

    return {
      replay: result.replay,
      quote_id: q.quoteCode,
      expires_at: q.expiresAt,
      premium_total: q.premiumTotal,
      sum_insured_total: q.sumInsuredTotal,
      disclosures: (() => {
        if (typeof q.disclosures !== 'string') return q.disclosures ?? {};
        try {
          return JSON.parse(q.disclosures || '{}');
        } catch {
          return {};
        }
      })(),
      offers: [
        {
          product_code: q.productModule.code,
          product_name: q.productModule.name,
          segment: q.productModule.segment,
        },
      ],
    };
  }
}
