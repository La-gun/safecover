import { Module } from '@nestjs/common';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';
import { AuditModule } from '../common/audit/audit.module';
import { ProductConfigModule } from '../product-config/product-config.module';

@Module({
  imports: [AuditModule, ProductConfigModule],
  controllers: [QuoteController],
  providers: [QuoteService],
})
export class QuoteModule {}
