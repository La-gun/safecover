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
exports.ProductsV1Controller = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/auth/auth.guard");
const prisma_service_1 = require("../../prisma/prisma.service");
let ProductsV1Controller = class ProductsV1Controller {
    constructor(prisma) {
        this.prisma = prisma;
    }
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
    async listJurisdictions() {
        return {
            supported: ['NG'],
            default: 'NG',
        };
    }
};
exports.ProductsV1Controller = ProductsV1Controller;
__decorate([
    (0, common_1.Get)('/products'),
    (0, common_1.UseGuards)(auth_guard_1.PartnerAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductsV1Controller.prototype, "listProducts", null);
__decorate([
    (0, common_1.Get)('/jurisdictions'),
    (0, common_1.UseGuards)(auth_guard_1.PartnerAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductsV1Controller.prototype, "listJurisdictions", null);
exports.ProductsV1Controller = ProductsV1Controller = __decorate([
    (0, swagger_1.ApiTags)('products-v1'),
    (0, common_1.Controller)('/api/v1'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsV1Controller);
//# sourceMappingURL=products.controller.js.map