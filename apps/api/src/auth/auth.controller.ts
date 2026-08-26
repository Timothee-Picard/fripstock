import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
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
  me(@AuthUser() currentUser: CurrentUser) {
    return this.auth.me(currentUser);
  }

  /**
   * Chacun modifie son propre profil, gérant comme employé. Aucun identifiant
   * n'est pris dans l'URL : la cible est toujours l'utilisateur du jeton.
   */
  @Put('profile')
  updateProfile(@AuthUser() currentUser: CurrentUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(currentUser, dto);
  }

  @Put('password')
  changePassword(@AuthUser() currentUser: CurrentUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(currentUser, dto);
  }
}
