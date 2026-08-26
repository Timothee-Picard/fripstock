import { Injectable, NotFoundException } from '@nestjs/common';
import type { CurrentUser } from '../common/types/current-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste des notifications de l'entreprise.
   *
   * Elles ne sont pas rattachées à un utilisateur : marquer une alerte comme lue
   * la masque pour toute l'entreprise. Assumé pour le MVP — voir la note dans
   * README.md.
   */
  async list(currentUser: CurrentUser) {
    const notifications = await this.prisma.notification.findMany({
      where: { companyId: currentUser.companyId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      include: {
        depositContract: {
          select: {
            id: true,
            endDate: true,
            depositor: { select: { id: true, lastName: true, firstName: true } },
          },
        },
      },
    });
    return {
      notifications,
      unread: notifications.filter((n) => !n.isRead).length,
    };
  }

  async markRead(currentUser: CurrentUser, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: { id: true },
    });
    if (!notification) throw new NotFoundException('Notification introuvable.');

    await this.prisma.notification.update({ where: { id }, data: { isRead: true } });
    return this.list(currentUser);
  }

  async markAllRead(currentUser: CurrentUser) {
    await this.prisma.notification.updateMany({
      where: { companyId: currentUser.companyId, isRead: false },
      data: { isRead: true },
    });
    return this.list(currentUser);
  }
}
