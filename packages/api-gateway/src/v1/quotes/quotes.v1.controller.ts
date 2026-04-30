import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { PartnerAuthGuard } from '../../common/auth/auth.guard';
import { CreateQuoteV1RequestDto } from './quotes.v1.dto';
import { QuotesV1Service } from './quotes.v1.service';

@ApiTags('quotes-v1')
@Controller('/api/v1')
export class QuotesV1Controller {
  constructor(private quotes: QuotesV1Service) {}

  @Post('/quotes')
  @UseGuards(PartnerAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async createQuote(
    @Req() req: { partner: { partnerCode: string }; headers: Record<string, string> },
    @Body() body: CreateQuoteV1RequestDto,
    @Headers('idempotency-key') idem?: string,
  ) {
    const correlationId = req.headers['x-correlation-id'];
    const result = await this.quotes.createQuote(req.partner.partnerCode, idem, body, correlationId);
    const q = result.quote;

    const offersBlock = this.quotes.buildOffers({
      quoteCode: q.quoteCode,
      productCode: q.productModule.code,
      productName: q.productModule.name,
      segment: q.productModule.segment,
      premiumBase: q.premiumTotal,
      sumInsuredTotal: q.sumInsuredTotal,
      mode: result.mode,
    });

    return {
      replay: result.replay,
      quote: {
        quote_id: q.quoteCode,
        status: q.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
        created_at: q.createdAt,
        expires_at: q.expiresAt,
        store_id: body.store_id,
        transaction_id: q.transactionId,
        channel: q.channel,
        jurisdiction: body.jurisdiction ?? null,
        currency: body.currency ?? q.productModule.currency,
        product_code: q.productModule.code,
        sum_insured_total: q.sumInsuredTotal,
        premium_total_min: Math.min(...offersBlock.offers.map((o) => o.pricing.premium_total)),
        premium_total_max: Math.max(...offersBlock.offers.map((o) => o.pricing.premium_total)),
        disclosures: q.disclosures,
        offers: offersBlock.offers,
        recommended_offer_id: offersBlock.recommended_offer_id,
        selected_offer_id: null,
      },
    };
  }

  @Get('/quotes/:quote_id')
  @UseGuards(PartnerAuthGuard)
  @ApiBearerAuth()
  async getQuote(
    @Req() req: { partner: { partnerCode: string } },
    @Param('quote_id') quoteId: string,
  ) {
    const q = await this.quotes.getQuoteByCode(req.partner.partnerCode, quoteId);
    if (!q) return { error: 'Not found', code: 'NOT_FOUND' };

    const offersBlock = this.quotes.buildOffers({
      quoteCode: q.quoteCode,
      productCode: q.productModule.code,
      productName: q.productModule.name,
      segment: q.productModule.segment,
      premiumBase: q.premiumTotal,
      sumInsuredTotal: q.sumInsuredTotal,
      mode: 'SINGLE' as any,
    });

    return {
      quote: {
        quote_id: q.quoteCode,
        status: q.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
        created_at: q.createdAt,
        expires_at: q.expiresAt,
        transaction_id: q.transactionId,
        channel: q.channel,
        currency: q.productModule.currency,
        product_code: q.productModule.code,
        sum_insured_total: q.sumInsuredTotal,
        premium_total_min: Math.min(...offersBlock.offers.map((o) => o.pricing.premium_total)),
        premium_total_max: Math.max(...offersBlock.offers.map((o) => o.pricing.premium_total)),
        disclosures: q.disclosures,
        offers: offersBlock.offers,
        recommended_offer_id: offersBlock.recommended_offer_id,
        selected_offer_id: null,
      },
    };
  }

  @Post('/quotes/:quote_id/select')
  @UseGuards(PartnerAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async selectOffer(
    @Param('quote_id') quoteId: string,
    @Body('offer_id') offerId: string,
  ) {
    return { quote_id: quoteId, selected_offer_id: offerId };
  }
}

