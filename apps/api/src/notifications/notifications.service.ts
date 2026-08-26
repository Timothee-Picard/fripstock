import { Injectable, NotFoundException } from '@nestjs/common';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Notifications de l'entreprise.
   *
   * Elles ne sont pas rattachées à un utilisateur : marquer une alerte comme lue
   * la masque pour toute l'entreprise. Assumé pour le MVP — voir la note dans
   * README.md.
   */
  async lister(courant: UtilisateurCourant) {
    const notifications = await this.prisma.notification.findMany({
      where: { entrepriseId: courant.entrepriseId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      include: {
        contratDepot: {
          select: {
            id: true,
            dateFin: true,
            client: { select: { id: true, nom: true, prenom: true } },
          },
        },
      },
    });
    return {
      notifications,
      nonLues: notifications.filter((n) => !n.isRead).length,
    };
  }

  async marquerLue(courant: UtilisateurCourant, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
      select: { id: true },
    });
    if (!notification) throw new NotFoundException('Notification introuvable.');

    await this.prisma.notification.update({ where: { id }, data: { isRead: true } });
    return this.lister(courant);
  }

  async toutMarquerLu(courant: UtilisateurCourant) {
    await this.prisma.notification.updateMany({
      where: { entrepriseId: courant.entrepriseId, isRead: false },
      data: { isRead: true },
    });
    return this.lister(courant);
  }
}
