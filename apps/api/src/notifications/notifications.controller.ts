import { Controller, Get, Param, Put } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { NotificationsService } from './notifications.service';

/**
 * Aucune permission fine : les alertes d'échéance concernent l'entreprise
 * entière, et les masquer à un employé ne protégerait rien.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@AuthUser() currentUser: CurrentUser) {
    return this.notifications.list(currentUser);
  }

  // Route littérale déclarée avant celle qui porte un paramètre.
  @Put('read-all')
  markAllRead(@AuthUser() currentUser: CurrentUser) {
    return this.notifications.markAllRead(currentUser);
  }

  @Put(':id/read')
  markRead(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.notifications.markRead(currentUser, id);
  }
}
