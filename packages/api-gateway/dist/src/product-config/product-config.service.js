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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductConfigService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const CACHE_TTL_MS = 60_000;
const productCache = new Map();
let ProductConfigService = class ProductConfigService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getByCode(code) {
        const cached = productCache.get(code);
        if (cached && cached.expires > Date.now())
            return cached.data;
        const pm = await this.prisma.productModule.findUnique({ where: { code } });
        if (!pm || !pm.isActive)
            throw new common_1.NotFoundException('Product module not found');
        productCache.set(code, { data: pm, expires: Date.now() + CACHE_TTL_MS });
        return pm;
    }
    enforceDefaultCaps(segment, sumInsuredTotal, cap) {
        if (sumInsuredTotal > cap) {
            return {
                allowed: false,
                reason: `Sum insured exceeds cap (${cap}) for segment ${segment}`,
            };
        }
        return { allowed: true };
    }
};
exports.ProductConfigService = ProductConfigService;
exports.ProductConfigService = ProductConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductConfigService);
//# sourceMappingURL=product-config.service.js.map