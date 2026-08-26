import { Logger } from '@nestjs/common';
import { DeadlinesJob } from './deadlines.job';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID } from '../test/fixtures';

const LE_10 = new Date('2026-08-10T09:00:00.000Z');

const contrat = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'c1',
  endDate: new Date('2026-08-15T00:00:00.000Z'),
  notifyBeforeDays: 7,
  notifiedAt: null,
  depositor: { companyId: COMPANY_ID, lastName: 'Martin', firstName: 'Sophie' },
  ...over,
});

describe('DeadlinesJob', () => {
  let prisma: PrismaMock;
  let job: DeadlinesJob;

  beforeEach(() => {
    prisma = createPrismaMock();
    job = new DeadlinesJob(asPrisma(prisma));
  });

  describe('run', () => {
    it('ne regarde que les contrats actifs', async () => {
      prisma.depositContract.findMany.mockResolvedValue([]);
      await job.run(LE_10);
      expect(prisma.depositContract.findMany.mock.calls[0][0].where).toEqual({ status: 'ACTIVE' });
    });

    it('alerte quand on entre dans la fenêtre de préavis', async () => {
      prisma.depositContract.findMany.mockResolvedValue([contrat()]);
      const { notified } = await job.run(LE_10);
      expect(notified).toBe(1);
      const data = prisma.notification.create.mock.calls[0][0].data;
      expect(data.companyId).toBe(COMPANY_ID);
      expect(data.type).toBe('CONTRACT_DEADLINE');
      expect(data.message).toContain('Sophie Martin');
      expect(data.message).toContain('15/08/2026');
    });

    it("n'alerte pas avant la fenêtre de préavis", async () => {
      prisma.depositContract.findMany.mockResolvedValue([contrat()]);
      const { notified } = await job.run(new Date('2026-08-01T09:00:00.000Z'));
      expect(notified).toBe(0);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it("n'alerte qu'une fois : notifiedAt fait office de verrou", async () => {
      prisma.depositContract.findMany.mockResolvedValue([contrat({ notifiedAt: new Date() })]);
      const { notified } = await job.run(LE_10);
      expect(notified).toBe(0);
    });

    it('note la date d’alerte dans la même transaction que la notification', async () => {
      prisma.depositContract.findMany.mockResolvedValue([contrat()]);
      await job.run(LE_10);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.depositContract.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { notifiedAt: LE_10 },
      });
    });

    it('compose le nom même sans prénom', async () => {
      prisma.depositContract.findMany.mockResolvedValue([
        contrat({ depositor: { companyId: COMPANY_ID, lastName: 'Martin', firstName: null } }),
      ]);
      await job.run(LE_10);
      expect(prisma.notification.create.mock.calls[0][0].data.message).toContain(
        'de Martin arrive',
      );
    });

    it('fait passer à EXPIRED un contrat dont la date est dépassée', async () => {
      prisma.depositContract.findMany.mockResolvedValue([
        contrat({ notifiedAt: new Date(), endDate: new Date('2026-08-01') }),
      ]);
      const { expired } = await job.run(LE_10);
      expect(expired).toBe(1);
      expect(prisma.depositContract.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'EXPIRED' },
      });
    });

    it("n'expire pas le jour même de l'échéance", async () => {
      prisma.depositContract.findMany.mockResolvedValue([
        contrat({ notifiedAt: new Date(), endDate: LE_10 }),
      ]);
      await expect(job.run(LE_10)).resolves.toMatchObject({ expired: 0 });
    });

    it('peut alerter et expirer le même contrat en une passe', async () => {
      prisma.depositContract.findMany.mockResolvedValue([
        contrat({ endDate: new Date('2026-08-01') }),
      ]);
      await expect(job.run(LE_10)).resolves.toEqual({ notified: 1, expired: 1 });
    });
  });

  describe('daily', () => {
    it('journalise seulement quand il s’est passé quelque chose', async () => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      prisma.depositContract.findMany.mockResolvedValue([]);
      await job.daily();
      expect(log).not.toHaveBeenCalled();

      prisma.depositContract.findMany.mockResolvedValue([contrat()]);
      await job.daily();
      expect(log).toHaveBeenCalledWith(expect.stringContaining('alerte(s)'));
      log.mockRestore();
    });
  });
});
