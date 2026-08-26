import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { GerantUniquement } from '../common/decorators/gerant.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { ContratsDepotService } from './contrats-depot.service';
import { EcheancesJob } from './echeances.job';
import { CreerContratDto } from './dto/creer-contrat.dto';
import { ModifierContratDto } from './dto/modifier-contrat.dto';
import { RattacherProduitsDto } from './dto/rattacher-produits.dto';

@Controller('contrats-depot')
export class ContratsDepotController {
  constructor(
    private readonly contrats: ContratsDepotService,
    private readonly echeancesJob: EcheancesJob,
  ) {}

  @Get()
  @RequirePermission('depots.gerer')
  lister(@Utilisateur() courant: UtilisateurCourant) {
    return this.contrats.lister(courant);
  }

  @Get(':id')
  @RequirePermission('depots.gerer')
  detail(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.contrats.detail(courant, id);
  }

  @Post()
  @RequirePermission('depots.gerer')
  creer(@Utilisateur() courant: UtilisateurCourant, @Body() dto: CreerContratDto) {
    return this.contrats.creer(courant, dto);
  }

  /**
   * Déclenche la passe d'échéances à la main. Réservé au gérant : attendre le
   * lendemain pour vérifier qu'une alerte part serait absurde.
   */
  @Post('echeances')
  @GerantUniquement()
  echeances() {
    return this.echeancesJob.executer();
  }

  @Post(':id/produits')
  @RequirePermission('depots.gerer')
  rattacher(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: RattacherProduitsDto,
  ) {
    return this.contrats.rattacherProduits(courant, id, dto);
  }

  @Delete(':id/produits/:produitId')
  @RequirePermission('depots.gerer')
  detacher(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Param('produitId') produitId: string,
  ) {
    return this.contrats.detacherProduit(courant, id, produitId);
  }

  @Put(':id')
  @RequirePermission('depots.gerer')
  modifier(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: ModifierContratDto,
  ) {
    return this.contrats.modifier(courant, id, dto);
  }

  @Delete(':id')
  @RequirePermission('depots.gerer')
  supprimer(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.contrats.supprimer(courant, id);
  }
}
