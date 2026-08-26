import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Alertes d'échéance et expiration des contrats de dépôt.
 *
 * Une seule passe quotidienne fait les deux : sans la transition vers `EXPIRED`,
 * rien ne sortirait jamais de `ACTIVE` et l'énumération ne servirait à rien.
 */
@Injectable()
export class DeadlinesJob {
  private readonly logger = new Logger(DeadlinesJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async daily(): Promise<void> {
    const result = await this.run();
    if (result.notifies > 0 || result.expires > 0) {
      this.logger.log(
        `Échéances : ${result.notifies} alerte(s), ${result.expires} contrat(s) expiré(s).`,
      );
    }
  }

  /**
   * Exposé pour être déclenché à la main (voir POST /deposit-contracts/deadlines,
   * réservé au gérant) : attendre 24 h pour vérifier une alerte serait absurde.
   */
  async run(maintenant = new Date()): Promise<{ notifies: number; expires: number }> {
    const actifs = await this.prisma.depositContract.findMany({
      where: { status: 'ACTIVE' },
      include: { depositor: { select: { companyId: true, lastName: true, firstName: true } } },
    });

    let notifies = 0;
    let expires = 0;

    for (const contract of actifs) {
      const seuil = new Date(contract.endDate);
      seuil.setDate(seuil.getDate() - contract.notifyBeforeDays);

      if (contract.notifiedAt === null && maintenant >= seuil) {
        const name = [contract.depositor.firstName, contract.depositor.lastName]
          .filter(Boolean)
          .join(' ');
        await this.prisma.$transaction([
          this.prisma.notification.create({
            data: {
              // DepositContract n'a pas de companyId : on remonte par le déposant.
              companyId: contract.depositor.companyId,
              type: 'CONTRAT_ECHEANCE',
              depositContractId: contract.id,
              message: `Le contrat de dépôt de ${name} arrive à échéance le ${contract.endDate.toLocaleDateString('fr-FR')}.`,
            },
          }),
          // `notifiedAt` est ce qui empêche de renotifier chaque jour jusqu'à
          // l'échéance.
          this.prisma.depositContract.update({
            where: { id: contract.id },
            data: { notifiedAt: maintenant },
          }),
        ]);
        notifies += 1;
      }

      if (maintenant > contract.endDate) {
        await this.prisma.depositContract.update({
          where: { id: contract.id },
          data: { status: 'EXPIRED' },
        });
        expires += 1;
      }
    }

    return { notifies, expires };
  }
}
