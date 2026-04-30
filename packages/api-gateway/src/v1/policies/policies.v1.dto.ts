import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum PaymentModeV1 {
  PLATFORM_COLLECTED = 'PLATFORM_COLLECTED',
  SAFECOVER_COLLECT = 'SAFECOVER_COLLECT',
}

class PaymentDto {
  @IsEnum(PaymentModeV1) mode!: PaymentModeV1;
  @IsOptional() @IsString() transaction_id?: string;
  @IsOptional() @IsInt() @Min(0) amount_paid?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() processor?: string;
  @IsOptional() @IsString() payment_reference?: string;
}

class CustomerDto {
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() customer_id?: string;
}

export class CreatePolicyV1RequestDto {
  @IsString() quote_id!: string;
  @IsString() offer_id!: string;
  @ValidateNested() @Type(() => PaymentDto) payment!: PaymentDto;
  @IsOptional() @ValidateNested() @Type(() => CustomerDto) customer?: CustomerDto;
  @IsOptional() @IsString() return_url?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

