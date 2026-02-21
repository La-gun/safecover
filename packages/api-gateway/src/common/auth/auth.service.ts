import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PartnerTokenPayload } from './auth.types';

const TOKEN_TTL_SEC = 60 * 30; // 30 min
const EXPIRES_IN = 1800;

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Constant-time comparison to prevent timing attacks on secret validation */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async tokenFromClientCredentials(clientId: string, clientSecret: string) {
    const secret = process.env.PARTNER_JWT_SECRET;
    const audience = process.env.PARTNER_JWT_AUDIENCE;
    const issuer = process.env.PARTNER_JWT_ISSUER;
    if (!secret || !audience || !issuer) {
      throw new UnauthorizedException('Auth configuration incomplete (PARTNER_JWT_* env vars required)');
    }
    if (!clientId?.trim() || !clientSecret?.trim()) {
      throw new UnauthorizedException('client_id and client_secret are required');
    }
    const client = await this.prisma.partnerOAuthClient.findUnique({
      where: { clientId },
      include: { partner: true },
    });
    if (!client) throw new UnauthorizedException('Invalid client credentials');
    if (!client.partner?.isActive) throw new UnauthorizedException('Partner inactive');

    const candidate = sha256(clientSecret);
    if (!secureCompare(candidate, client.clientHash)) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    const partner = client.partner;
    const scopes = this.parseScopes(client.scopes);
    const now = Math.floor(Date.now() / 1000);

    const payload: PartnerTokenPayload = {
      sub: clientId,
      partnerCode: partner.code,
      scopes,
      aud: audience,
      iss: issuer,
      iat: now,
      exp: now + TOKEN_TTL_SEC,
    };

    const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: EXPIRES_IN,
      scope: scopes.join(' '),
    };
  }

  private parseScopes(scopes: string): string[] {
    try {
      const parsed = JSON.parse(scopes);
      return Array.isArray(parsed) ? parsed : [scopes];
    } catch {
      return scopes ? [scopes] : [];
    }
  }
}
