import jwt from 'jsonwebtoken';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PartnerTokenPayload } from './auth.types';

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class PartnerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'];
    if (!auth?.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = auth.slice(BEARER_PREFIX.length);
    const secret = process.env.PARTNER_JWT_SECRET;
    const audience = process.env.PARTNER_JWT_AUDIENCE;
    const issuer = process.env.PARTNER_JWT_ISSUER;

    try {
      const decoded = jwt.verify(token, secret!, {
        audience,
        issuer,
      }) as PartnerTokenPayload;

      req.partner = {
        partnerCode: decoded.partnerCode,
        scopes: decoded.scopes,
        clientId: decoded.sub,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
