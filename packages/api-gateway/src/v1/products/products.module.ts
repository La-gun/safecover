import { Module } from '@nestjs/common';
import { ProductsV1Controller } from './products.controller';

@Module({
  controllers: [ProductsV1Controller],
})
export class ProductsV1Module {}

