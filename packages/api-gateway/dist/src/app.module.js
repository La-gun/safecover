"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./common/auth/auth.module");
const audit_module_1 = require("./common/audit/audit.module");
const product_config_module_1 = require("./product-config/product-config.module");
const quote_module_1 = require("./quote/quote.module");
const products_module_1 = require("./v1/products/products.module");
const quotes_v1_module_1 = require("./v1/quotes/quotes.v1.module");
const policies_v1_module_1 = require("./v1/policies/policies.v1.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            audit_module_1.AuditModule,
            product_config_module_1.ProductConfigModule,
            quote_module_1.QuoteModule,
            products_module_1.ProductsV1Module,
            quotes_v1_module_1.QuotesV1Module,
            policies_v1_module_1.PoliciesV1Module,
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map