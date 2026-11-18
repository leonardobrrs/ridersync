import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google.service';
import { SessionService } from './session.service';
import { ReauthService } from './reauth.service';
import { TokenService } from './token.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, TokenService, GoogleAuthService, ReauthService],
  exports: [AuthService, SessionService, TokenService, ReauthService],
})
export class AuthModule {}
