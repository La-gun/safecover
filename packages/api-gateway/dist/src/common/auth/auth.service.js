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
exports.AuthService = void 0;
const crypto_1 = require("crypto");
const jsonwebtoken_1 = require("jsonwebtoken");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const TOKEN_TTL_SEC = 60 * 30;
const EXPIRES_IN = 1800;
function sha256(input) {
    return crypto_1.default.createHash('sha256').update(input).digest('hex');
}
function secureCompare(a, b) {
    if (a.length !== b.length)
        return false;
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length)
        return false;
    return crypto_1.default.timingSafeEqual(bufA, bufB);
}
let AuthService = class AuthService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async tokenFromClientCredentials(clientId, clientSecret) {
        const secret = process.env.PARTNER_JWT_SECRET;
        const audience = process.env.PARTNER_JWT_AUDIENCE;
        const issuer = process.env.PARTNER_JWT_ISSUER;
        if (!secret || !audience || !issuer) {
            throw new common_1.UnauthorizedException('Auth configuration incomplete (PARTNER_JWT_* env vars required)');
        }
        if (!clientId?.trim() || !clientSecret?.trim()) {
            throw new common_1.UnauthorizedException('client_id and client_secret are required');
        }
        const client = await this.prisma.partnerOAuthClient.findUnique({
            where: { clientId },
            include: { partner: true },
        });
        if (!client)
            throw new common_1.UnauthorizedException('Invalid client credentials');
        if (!client.partner?.isActive)
            throw new common_1.UnauthorizedException('Partner inactive');
        const candidate = sha256(clientSecret);
        if (!secureCompare(candidate, client.clientHash)) {
            throw new common_1.UnauthorizedException('Invalid client credentials');
        }
        const partner = client.partner;
        const scopes = this.parseScopes(client.scopes);
        const now = Math.floor(Date.now() / 1000);
        const payload = {
            sub: clientId,
            partnerCode: partner.code,
            scopes,
            aud: audience,
            iss: issuer,
            iat: now,
            exp: now + TOKEN_TTL_SEC,
        };
        const token = jsonwebtoken_1.default.sign(payload, secret, { algorithm: 'HS256' });
        return {
            access_token: token,
            token_type: 'Bearer',
            expires_in: EXPIRES_IN,
            scope: scopes.join(' '),
        };
    }
    parseScopes(scopes) {
        if (Array.isArray(scopes))
            return scopes;
        if (!scopes)
            return [];
        try {
            const parsed = JSON.parse(scopes);
            return Array.isArray(parsed) ? parsed : [scopes];
        }
        catch {
            return [scopes];
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map