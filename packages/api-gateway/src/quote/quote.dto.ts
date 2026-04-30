import {
  IsArray,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class QuoteItemDto {
  @IsString() sku!: string;
  @IsInt() @Min(1) price!: number;
  @IsString() serial!: string;
  @IsString() category!: string;
}

export class QuoteRequestDto {
  @IsString() store_id!: string;
  @IsString() transaction_id!: string;
  @IsISO8601() timestamp!: string;
  @IsOptional() @IsString() customer_id?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
  @IsString() @IsNotEmpty() channel!: 'POS' | 'WEB' | 'APP' | 'USSD';
  @IsOptional() @IsString() product_code?: string;
}
