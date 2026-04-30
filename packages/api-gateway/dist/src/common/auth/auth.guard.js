"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnerAuthGuard = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const common_1 = require("@nestjs/common");
const BEARER_PREFIX = 'Bearer ';
let PartnerAuthGuard = class PartnerAuthGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const auth = req.headers['authorization'];
        if (!auth?.startsWith(BEARER_PREFIX)) {
            throw new common_1.UnauthorizedException('Missing bearer token');
        }
        const token = auth.slice(BEARER_PREFIX.length);
        const secret = process.env.PARTNER_JWT_SECRET;
        const audience = process.env.PARTNER_JWT_AUDIENCE;
        const issuer = process.env.PARTNER_JWT_ISSUER;
        try {
            const decoded = jsonwebtoken_1.default.verify(token, secret, {
                audience,
                issuer,
            });
            req.partner = {
                partnerCode: decoded.partnerCode,
                scopes: decoded.scopes,
                clientId: decoded.sub,
            };
            return true;
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid token');
        }
    }
};
exports.PartnerAuthGuard = PartnerAuthGuard;
exports.PartnerAuthGuard = PartnerAuthGuard = __decorate([
    (0, common_1.Injectable)()
], PartnerAuthGuard);
//# sourceMappingURL=auth.guard.js.map