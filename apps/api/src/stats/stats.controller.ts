import { Controller, Get, Query } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { PeriodDto } from './dto/period.dto';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  /**
   * Volontairement sans @RequirePermission : le tableau de bord n'est plus
   * gouverné par un droit unique.
   *
   * Trois droits y ouvrent des blocs différents — `stats.view` pour les
   * chiffres d'argent, `stock.view` pour l'état du stock,
   * `products.changeStatus` pour la recette du jour — et un garde de route ne
   * saurait en exiger qu'un seul. C'est le service qui découpe, et qui n'envoie
   * que les blocs autorisés : un employé sans aucun de ces droits reçoit la
   * seule période.
   */
  @Get('dashboard')
  dashboard(@AuthUser() currentUser: CurrentUser, @Query() filters: PeriodDto) {
    return this.stats.dashboard(currentUser, filters);
  }
}
