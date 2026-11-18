import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController, GoogleAuthController],
  providers: [AuthService, SessionService, GoogleAuthService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
