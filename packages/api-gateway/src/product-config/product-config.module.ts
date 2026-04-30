import { Module } from '@nestjs/common';
import { ProductConfigService } from './product-config.service';

@Module({
  providers: [ProductConfigService],
  exports: [ProductConfigService],
})
export class ProductConfigModule {}
