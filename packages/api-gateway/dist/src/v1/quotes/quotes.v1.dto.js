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
exports.CreateQuoteV1RequestDto = exports.ChannelV1 = exports.QuoteModeV1 = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var QuoteModeV1;
(function (QuoteModeV1) {
    QuoteModeV1["SINGLE"] = "SINGLE";
    QuoteModeV1["RATE"] = "RATE";
    QuoteModeV1["COMPARE"] = "COMPARE";
})(QuoteModeV1 || (exports.QuoteModeV1 = QuoteModeV1 = {}));
var ChannelV1;
(function (ChannelV1) {
    ChannelV1["POS"] = "POS";
    ChannelV1["WEB"] = "WEB";
    ChannelV1["APP"] = "APP";
    ChannelV1["USSD"] = "USSD";
})(ChannelV1 || (exports.ChannelV1 = ChannelV1 = {}));
class CustomerDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerDto.prototype, "customer_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CustomerDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerDto.prototype, "phone", void 0);
class QuoteItemV1Dto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QuoteItemV1Dto.prototype, "sku", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QuoteItemV1Dto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QuoteItemV1Dto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], QuoteItemV1Dto.prototype, "quantity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], QuoteItemV1Dto.prototype, "unit_price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], QuoteItemV1Dto.prototype, "declared_value", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QuoteItemV1Dto.prototype, "serial", void 0);
class CreateQuoteV1RequestDto {
}
exports.CreateQuoteV1RequestDto = CreateQuoteV1RequestDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuoteV1RequestDto.prototype, "store_id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuoteV1RequestDto.prototype, "transaction_id", void 0);
__decorate([
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], CreateQuoteV1RequestDto.prototype, "timestamp", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(ChannelV1),
    __metadata("design:type", String)
], CreateQuoteV1RequestDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuoteV1RequestDto.prototype, "jurisdiction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuoteV1RequestDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(QuoteModeV1),
    __metadata("design:type", String)
], CreateQuoteV1RequestDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuoteV1RequestDto.prototype, "product_code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CustomerDto),
    __metadata("design:type", CustomerDto)
], CreateQuoteV1RequestDto.prototype, "customer", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => QuoteItemV1Dto),
    __metadata("design:type", Array)
], CreateQuoteV1RequestDto.prototype, "items", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateQuoteV1RequestDto.prototype, "risk_data", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateQuoteV1RequestDto.prototype, "metadata", void 0);
//# sourceMappingURL=quotes.v1.dto.js.map