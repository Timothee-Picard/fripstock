import { Controller, Get, Param, Put } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { NotificationsService } from './notifications.service';

/**
 * Aucune permission fine : les alertes d'échéance concernent l'entreprise
 * entière, et les masquer à un employé ne protégerait rien.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  lister(@Utilisateur() courant: UtilisateurCourant) {
    return this.notifications.lister(courant);
  }

  // Route littérale déclarée avant celle qui porte un paramètre.
  @Put('tout-lu')
  toutLu(@Utilisateur() courant: UtilisateurCourant) {
    return this.notifications.toutMarquerLu(courant);
  }

  @Put(':id/lu')
  marquerLue(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.notifications.marquerLue(courant, id);
  }
}
