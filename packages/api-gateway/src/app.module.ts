import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './common/auth/auth.module';
import { AuditModule } from './common/audit/audit.module';
import { ProductConfigModule } from './product-config/product-config.module';
import { QuoteModule } from './quote/quote.module';
import { ProductsV1Module } from './v1/products/products.module';
import { QuotesV1Module } from './v1/quotes/quotes.v1.module';
import { PoliciesV1Module } from './v1/policies/policies.v1.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    ProductConfigModule,
    QuoteModule,
    ProductsV1Module,
    QuotesV1Module,
    PoliciesV1Module,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
