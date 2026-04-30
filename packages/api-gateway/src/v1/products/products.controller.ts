import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PartnerAuthGuard } from '../../common/auth/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('products-v1')
@Controller('/api/v1')
export class ProductsV1Controller {
  constructor(private prisma: PrismaService) {}

  @Get('/products')
  @UseGuards(PartnerAuthGuard)
  @ApiBearerAuth()
  async listProducts() {
    const products = await this.prisma.productModule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      products: products.map((p) => ({
        product_code: p.code,
        name: p.name,
        segment: p.segment,
        is_active: p.isActive,
        currency: p.currency,
        sum_insured_cap: p.sumInsuredCap,
        disclosures: {
          plain_language_summary_md: p.disclosureMd,
          cooling_off_days: p.coolingOffDays,
          key_rules: p.rulesJson,
        },
        quote_ttl_seconds: 900,
        jurisdictions: [],
      })),
    };
  }

  @Get('/jurisdictions')
  @UseGuards(PartnerAuthGuard)
  @ApiBearerAuth()
  async listJurisdictions() {
    return {
      supported: ['NG'],
      default: 'NG',
    };
  }
}

