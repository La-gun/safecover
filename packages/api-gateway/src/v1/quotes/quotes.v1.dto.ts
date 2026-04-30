import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum QuoteModeV1 {
  SINGLE = 'SINGLE',
  RATE = 'RATE',
  COMPARE = 'COMPARE',
}

export enum ChannelV1 {
  POS = 'POS',
  WEB = 'WEB',
  APP = 'APP',
  USSD = 'USSD',
}

class CustomerDto {
  @IsOptional() @IsString() customer_id?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
}

class QuoteItemV1Dto {
  @IsString() sku!: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsInt() @Min(0) unit_price?: number;
  @IsOptional() @IsInt() @Min(0) declared_value?: number;
  @IsOptional() @IsString() serial?: string;
}

export class CreateQuoteV1RequestDto {
  @IsString() store_id!: string;
  @IsString() transaction_id!: string;
  @IsISO8601() timestamp!: string;
  @IsEnum(ChannelV1) channel!: ChannelV1;

  @IsOptional() @IsString() jurisdiction?: string;
  @IsOptional() @IsString() currency?: string;

  @IsOptional() @IsEnum(QuoteModeV1) mode?: QuoteModeV1;
  @IsOptional() @IsString() product_code?: string;

  @IsOptional() @ValidateNested() @Type(() => CustomerDto) customer?: CustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemV1Dto)
  items!: QuoteItemV1Dto[];

  @IsOptional() @IsObject() risk_data?: Record<string, unknown>;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

