import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { GerantUniquement } from '../common/decorators/gerant.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { DefinirAccesDto } from './dto/definir-acces.dto';
import { InviterUserDto } from './dto/inviter-user.dto';
import { UsersService } from './users.service';

/** Gestion des employés : entièrement réservée au gérant de l'entreprise. */
@Controller('users')
@GerantUniquement()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  lister(@Utilisateur() courant: UtilisateurCourant) {
    return this.users.lister(courant);
  }

  @Post('invite')
  inviter(@Utilisateur() courant: UtilisateurCourant, @Body() dto: InviterUserDto) {
    return this.users.inviter(courant, dto);
  }

  @Put(':id/acces')
  definirAcces(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: DefinirAccesDto,
  ) {
    return this.users.definirAcces(courant, id, dto);
  }

  @Delete(':id')
  supprimer(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.users.supprimer(courant, id);
  }
}
