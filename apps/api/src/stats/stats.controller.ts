import { Controller, Get, Query } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { PeriodDto } from './dto/period.dto';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  /**
   * `shopId` en query : le PermissionsGuard s'en sert pour vérifier
   * `stats.view` sur la boutique visée. Sans lui, c'est la règle du stock
   * central qui s'applique — la permission sur au moins une boutique suffit,
   * et les chiffres portent alors sur toute l'entreprise.
   */
  @Get('dashboard')
  @RequirePermission('stats.view')
  dashboard(@AuthUser() currentUser: CurrentUser, @Query() filters: PeriodDto) {
    return this.stats.dashboard(currentUser, filters);
  }
}
