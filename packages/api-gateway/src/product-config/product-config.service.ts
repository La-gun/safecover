import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
const CACHE_TTL_MS = 60_000; // 1 min
const productCache = new Map<string, { data: Awaited<ReturnType<PrismaService['productModule']['findUnique']>>; expires: number }>();

@Injectable()
export class ProductConfigService {
  constructor(private prisma: PrismaService) {}

  async getByCode(code: string) {
    const cached = productCache.get(code);
    if (cached && cached.expires > Date.now()) return cached.data!;

    const pm = await this.prisma.productModule.findUnique({ where: { code } });
    if (!pm || !pm.isActive) throw new NotFoundException('Product module not found');

    productCache.set(code, { data: pm, expires: Date.now() + CACHE_TTL_MS });
    return pm;
  }

  enforceDefaultCaps(
    segment: string,
    sumInsuredTotal: number,
    cap: number,
  ): { allowed: true } | { allowed: false; reason: string } {
    if (sumInsuredTotal > cap) {
      return {
        allowed: false,
        reason: `Sum insured exceeds cap (${cap}) for segment ${segment}`,
      };
    }
    return { allowed: true };
  }
}
