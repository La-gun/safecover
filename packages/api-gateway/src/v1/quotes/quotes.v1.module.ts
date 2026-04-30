import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { ProductConfigModule } from '../../product-config/product-config.module';
import { QuotesV1Controller } from './quotes.v1.controller';
import { QuotesV1Service } from './quotes.v1.service';

@Module({
  imports: [AuditModule, ProductConfigModule],
  controllers: [QuotesV1Controller],
  providers: [QuotesV1Service],
})
export class QuotesV1Module {}

