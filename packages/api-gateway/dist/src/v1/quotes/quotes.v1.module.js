"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotesV1Module = void 0;
const common_1 = require("@nestjs/common");
const audit_module_1 = require("../../common/audit/audit.module");
const product_config_module_1 = require("../../product-config/product-config.module");
const quotes_v1_controller_1 = require("./quotes.v1.controller");
const quotes_v1_service_1 = require("./quotes.v1.service");
let QuotesV1Module = class QuotesV1Module {
};
exports.QuotesV1Module = QuotesV1Module;
exports.QuotesV1Module = QuotesV1Module = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule, product_config_module_1.ProductConfigModule],
        controllers: [quotes_v1_controller_1.QuotesV1Controller],
        providers: [quotes_v1_service_1.QuotesV1Service],
    })
], QuotesV1Module);
//# sourceMappingURL=quotes.v1.module.js.map