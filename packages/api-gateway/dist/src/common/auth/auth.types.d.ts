export type PartnerTokenPayload = {
    sub: string;
    partnerCode: string;
    scopes: string[];
    iat: number;
    exp: number;
    aud: string;
    iss: string;
};
