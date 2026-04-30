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
exports.AuditService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
function hashEvent(input) {
    return crypto_1.default.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
let AuditService = class AuditService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async append(evt) {
        const [prev] = await this.prisma.auditEvent.findMany({
            where: { entityType: evt.entityType, entityId: evt.entityId },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { eventHash: true },
        });
        const base = {
            ...evt,
            prevHash: prev?.eventHash ?? null,
            createdAt: new Date().toISOString(),
        };
        const eventHash = hashEvent(base);
        await this.prisma.auditEvent.create({
            data: {
                actorType: evt.actorType,
                actorId: evt.actorId,
                partnerCode: evt.partnerCode,
                entityType: evt.entityType,
                entityId: evt.entityId,
                eventType: evt.eventType,
                correlationId: evt.correlationId,
                payload: JSON.stringify(evt.payload),
                prevHash: prev?.eventHash ?? null,
                eventHash,
            },
        });
        return { eventHash };
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
//# sourceMappingURL=audit.service.js.map