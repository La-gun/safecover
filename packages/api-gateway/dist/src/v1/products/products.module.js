"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsV1Module = void 0;
const common_1 = require("@nestjs/common");
const products_controller_1 = require("./products.controller");
let ProductsV1Module = class ProductsV1Module {
};
exports.ProductsV1Module = ProductsV1Module;
exports.ProductsV1Module = ProductsV1Module = __decorate([
    (0, common_1.Module)({
        controllers: [products_controller_1.ProductsV1Controller],
    })
], ProductsV1Module);
//# sourceMappingURL=products.module.js.map