import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { PoliciesV1Controller } from './policies.v1.controller';
import { PoliciesV1Service } from './policies.v1.service';

@Module({
  imports: [AuditModule],
  controllers: [PoliciesV1Controller],
  providers: [PoliciesV1Service],
})
export class PoliciesV1Module {}

