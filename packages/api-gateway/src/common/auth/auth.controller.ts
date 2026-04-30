import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('/api')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('/oauth/token')
  async token(
    @Body('grant_type') grantType: string,
    @Body('client_id') clientId: string,
    @Body('client_secret') clientSecret: string,
  ) {
    if (grantType !== 'client_credentials') {
      return { error: 'unsupported_grant_type', error_description: 'Only client_credentials supported' };
    }
    return this.auth.tokenFromClientCredentials(clientId, clientSecret);
  }
}
