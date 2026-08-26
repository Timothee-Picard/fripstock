import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Alertes d'échéance et expiration des contrats de dépôt.
 *
 * Une seule passe quotidienne fait les deux : sans la transition vers `EXPIRE`,
 * rien ne sortirait jamais de `ACTIF` et l'énumération ne servirait à rien.
 */
@Injectable()
export class EcheancesJob {
  private readonly logger = new Logger(EcheancesJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async quotidien(): Promise<void> {
    const resultat = await this.executer();
    if (resultat.notifies > 0 || resultat.expires > 0) {
      this.logger.log(
        `Échéances : ${resultat.notifies} alerte(s), ${resultat.expires} contrat(s) expiré(s).`,
      );
    }
  }

  /**
   * Exposé pour être déclenché à la main (voir POST /contrats-depot/echeances,
   * réservé au gérant) : attendre 24 h pour vérifier une alerte serait absurde.
   */
  async executer(maintenant = new Date()): Promise<{ notifies: number; expires: number }> {
    const actifs = await this.prisma.contratDepot.findMany({
      where: { statut: 'ACTIF' },
      include: { client: { select: { entrepriseId: true, nom: true, prenom: true } } },
    });

    let notifies = 0;
    let expires = 0;

    for (const contrat of actifs) {
      const seuil = new Date(contrat.dateFin);
      seuil.setDate(seuil.getDate() - contrat.notifyBeforeDays);

      if (contrat.notifieLe === null && maintenant >= seuil) {
        const nom = [contrat.client.prenom, contrat.client.nom].filter(Boolean).join(' ');
        await this.prisma.$transaction([
          this.prisma.notification.create({
            data: {
              // ContratDepot n'a pas de entrepriseId : on remonte par le client.
              entrepriseId: contrat.client.entrepriseId,
              type: 'CONTRAT_ECHEANCE',
              contratDepotId: contrat.id,
              message: `Le contrat de dépôt de ${nom} arrive à échéance le ${contrat.dateFin.toLocaleDateString('fr-FR')}.`,
            },
          }),
          // `notifieLe` est ce qui empêche de renotifier chaque jour jusqu'à
          // l'échéance.
          this.prisma.contratDepot.update({
            where: { id: contrat.id },
            data: { notifieLe: maintenant },
          }),
        ]);
        notifies += 1;
      }

      if (maintenant > contrat.dateFin) {
        await this.prisma.contratDepot.update({
          where: { id: contrat.id },
          data: { statut: 'EXPIRE' },
        });
        expires += 1;
      }
    }

    return { notifies, expires };
  }
}
