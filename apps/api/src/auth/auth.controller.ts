import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  me(@Utilisateur() courant: UtilisateurCourant) {
    return this.auth.me(courant);
  }
}
