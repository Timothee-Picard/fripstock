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
    if (result.notified > 0 || result.expired > 0) {
      this.logger.log(
        `Échéances : ${result.notified} alerte(s), ${result.expired} contrat(s) expiré(s).`,
      );
    }
  }

  /**
   * Exposé pour être déclenché à la main (voir POST /deposit-contracts/deadlines,
   * réservé au gérant) : attendre 24 h pour vérifier une alerte serait absurde.
   */
  async run(now = new Date()): Promise<{ notified: number; expired: number }> {
    const active = await this.prisma.depositContract.findMany({
      where: { status: 'ACTIVE' },
      include: { depositor: { select: { companyId: true, lastName: true, firstName: true } } },
    });

    let notified = 0;
    let expired = 0;

    for (const contract of active) {
      const threshold = new Date(contract.endDate);
      threshold.setDate(threshold.getDate() - contract.notifyBeforeDays);

      if (contract.notifiedAt === null && now >= threshold) {
        const name = [contract.depositor.firstName, contract.depositor.lastName]
          .filter(Boolean)
          .join(' ');
        await this.prisma.$transaction([
          this.prisma.notification.create({
            data: {
              // DepositContract n'a pas de companyId : on remonte par le déposant.
              companyId: contract.depositor.companyId,
              type: 'CONTRACT_DEADLINE',
              depositContractId: contract.id,
              message: `Le contrat de dépôt de ${name} arrive à échéance le ${contract.endDate.toLocaleDateString('fr-FR')}.`,
            },
          }),
          // `notifiedAt` est ce qui empêche de renotifier chaque jour jusqu'à
          // l'échéance.
          this.prisma.depositContract.update({
            where: { id: contract.id },
            data: { notifiedAt: now },
          }),
        ]);
        notified += 1;
      }

      if (now > contract.endDate) {
        await this.prisma.depositContract.update({
          where: { id: contract.id },
          data: { status: 'EXPIRED' },
        });
        expired += 1;
      }
    }

    return { notified, expired };
  }
}
