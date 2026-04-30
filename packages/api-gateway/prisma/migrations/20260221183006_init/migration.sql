-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PartnerOAuthClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "clientHash" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    CONSTRAINT "PartnerOAuthClient_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Store_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sumInsuredCap" INTEGER NOT NULL DEFAULT 2000000,
    "coolingOffDays" INTEGER NOT NULL DEFAULT 7,
    "disclosureMd" TEXT,
    "rulesJson" TEXT
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteCode" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productModuleId" TEXT NOT NULL,
    "customerId" TEXT,
    "transactionId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "premiumTotal" INTEGER NOT NULL,
    "sumInsuredTotal" INTEGER NOT NULL,
    "disclosures" TEXT,
    "idempotencyKey" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quote_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quote_productModuleId_fkey" FOREIGN KEY ("productModuleId") REFERENCES "ProductModule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "serialHash" TEXT NOT NULL,
    CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "partnerCode" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "correlationId" TEXT,
    "payload" TEXT,
    "prevHash" TEXT,
    "eventHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Partner_code_key" ON "Partner"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOAuthClient_clientId_key" ON "PartnerOAuthClient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_storeId_key" ON "Store"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModule_code_key" ON "ProductModule"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteCode_key" ON "Quote"("quoteCode");
