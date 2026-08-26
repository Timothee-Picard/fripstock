import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { ClientsDeposantsService } from './clients-deposants.service';
import { CreerClientDto } from './dto/creer-client.dto';
import { ModifierClientDto } from './dto/modifier-client.dto';

/**
 * Un déposant appartient à l'entreprise, pas à une boutique : il peut avoir des
 * articles dans plusieurs d'entre elles. Les routes n'ont donc pas de
 * `boutiqueId` et tombent dans la règle du stock central du PermissionsGuard.
 */
@Controller('clients-deposants')
export class ClientsDeposantsController {
  constructor(private readonly clients: ClientsDeposantsService) {}

  @Get()
  @RequirePermission('clients.gerer')
  lister(@Utilisateur() courant: UtilisateurCourant) {
    return this.clients.lister(courant);
  }

  @Get(':id')
  @RequirePermission('clients.gerer')
  detail(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.clients.detail(courant, id);
  }

  @Get(':id/produits')
  @RequirePermission('clients.gerer')
  produits(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.clients.produits(courant, id);
  }

  @Get(':id/releve')
  @RequirePermission('clients.gerer')
  releve(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.clients.releve(courant, id);
  }

  @Post()
  @RequirePermission('clients.gerer')
  creer(@Utilisateur() courant: UtilisateurCourant, @Body() dto: CreerClientDto) {
    return this.clients.creer(courant, dto);
  }

  @Put(':id')
  @RequirePermission('clients.gerer')
  modifier(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: ModifierClientDto,
  ) {
    return this.clients.modifier(courant, id, dto);
  }

  @Delete(':id')
  @RequirePermission('clients.gerer')
  supprimer(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.clients.supprimer(courant, id);
  }
}
