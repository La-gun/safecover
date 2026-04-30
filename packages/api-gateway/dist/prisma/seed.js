"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto = require("crypto");
const prisma = new client_1.PrismaClient();
function sha256(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}
async function main() {
    const partner = await prisma.partner.upsert({
        where: { code: 'DEMO' },
        create: {
            code: 'DEMO',
            name: 'Demo Partner',
            isActive: true,
        },
        update: {},
    });
    const clientSecret = 'demo-secret-change-in-production';
    await prisma.partnerOAuthClient.upsert({
        where: { clientId: 'demo-client' },
        create: {
            clientId: 'demo-client',
            clientName: 'Demo Client',
            clientHash: sha256(clientSecret),
            partnerId: partner.id,
            scopes: ['quote', 'bind'],
        },
        update: {},
    });
    await prisma.store.upsert({
        where: { storeId: 'STORE-ABC123' },
        create: {
            storeId: 'STORE-ABC123',
            name: 'Demo Store',
            country: 'NG',
            partnerId: partner.id,
            isActive: true,
        },
        update: {},
    });
    await prisma.productModule.upsert({
        where: { code: 'ASSET_BASIC' },
        create: {
            code: 'ASSET_BASIC',
            name: 'Asset Protection Basic',
            segment: 'ASSET',
            isActive: true,
            sumInsuredCap: 2_000_000,
            coolingOffDays: 7,
            disclosureMd: 'Plain-language summary for asset protection.',
            rulesJson: '{}',
        },
        update: {},
    });
    console.log('Seed complete. Demo client: demo-client, secret:', clientSecret);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map