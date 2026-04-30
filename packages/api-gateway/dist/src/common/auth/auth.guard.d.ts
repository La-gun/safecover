import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class PartnerAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
