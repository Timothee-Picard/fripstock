import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID, manager } from '../test/fixtures';

const notif = (id: string, isRead: boolean) => ({ id, isRead, companyId: COMPANY_ID });

describe('NotificationsService', () => {
  let prisma: PrismaMock;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new NotificationsService(asPrisma(prisma));
  });

  describe('list', () => {
    it('remonte les non lues en premier, plafonnées à 50', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      await service.list(manager);
      const args = prisma.notification.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ companyId: COMPANY_ID });
      expect(args.orderBy).toEqual([{ isRead: 'asc' }, { createdAt: 'desc' }]);
      expect(args.take).toBe(50);
    });

    it('compte les non lues', async () => {
      prisma.notification.findMany.mockResolvedValue([
        notif('a', false),
        notif('b', true),
        notif('c', false),
      ]);
      await expect(service.list(manager)).resolves.toMatchObject({ unread: 2 });
    });

    it('rend zéro non lue quand tout est lu', async () => {
      prisma.notification.findMany.mockResolvedValue([notif('a', true)]);
      await expect(service.list(manager)).resolves.toMatchObject({ unread: 0 });
    });
  });

  describe('markRead', () => {
    it('marque puis renvoie la liste à jour', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'a' });
      prisma.notification.findMany.mockResolvedValue([notif('a', true)]);
      await expect(service.markRead(manager, 'a')).resolves.toMatchObject({ unread: 0 });
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'a' },
        data: { isRead: true },
      });
    });

    it("refuse une notification d'une autre entreprise", async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      await expect(service.markRead(manager, 'a')).rejects.toThrow(NotFoundException);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it("ne touche qu'aux non lues de l'entreprise", async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      await service.markAllRead(manager);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID, isRead: false },
        data: { isRead: true },
      });
    });
  });
});
