import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { AuthService } from './auth.service';
import { ChangerMotDePasseDto } from './dto/changer-mot-de-passe.dto';
import { LoginDto } from './dto/login.dto';
import { ModifierProfilDto } from './dto/modifier-profil.dto';
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

  /**
   * Chacun modifie son propre profil, gérant comme employé. Aucun identifiant
   * n'est pris dans l'URL : la cible est toujours l'utilisateur du jeton.
   */
  @Put('profil')
  modifierProfil(@Utilisateur() courant: UtilisateurCourant, @Body() dto: ModifierProfilDto) {
    return this.auth.modifierProfil(courant, dto);
  }

  @Put('mot-de-passe')
  changerMotDePasse(@Utilisateur() courant: UtilisateurCourant, @Body() dto: ChangerMotDePasseDto) {
    return this.auth.changerMotDePasse(courant, dto);
  }
}
