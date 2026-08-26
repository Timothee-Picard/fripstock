import { Controller, Get, Query } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { PeriodeDto } from './dto/periode.dto';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  /**
   * `boutiqueId` en query : le PermissionsGuard s'en sert pour vérifier
   * `stats.voir` sur la boutique visée. Sans lui, c'est la règle du stock
   * central qui s'applique — la permission sur au moins une boutique suffit,
   * et les chiffres portent alors sur toute l'entreprise.
   */
  @Get('dashboard')
  @RequirePermission('stats.voir')
  dashboard(@Utilisateur() courant: UtilisateurCourant, @Query() filtres: PeriodeDto) {
    return this.stats.tableauDeBord(courant, filtres);
  }
}
