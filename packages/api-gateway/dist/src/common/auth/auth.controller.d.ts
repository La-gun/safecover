import { AuthService } from './auth.service';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    token(grantType: string, clientId: string, clientSecret: string): Promise<{
        access_token: string;
        token_type: string;
        expires_in: number;
        scope: string;
    } | {
        error: string;
        error_description: string;
    }>;
}
