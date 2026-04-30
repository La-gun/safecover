import { PrismaService } from '../../prisma/prisma.service';
export declare class AuthService {
    private prisma;
    constructor(prisma: PrismaService);
    tokenFromClientCredentials(clientId: string, clientSecret: string): Promise<{
        access_token: string;
        token_type: string;
        expires_in: number;
        scope: string;
    }>;
    private parseScopes;
}
