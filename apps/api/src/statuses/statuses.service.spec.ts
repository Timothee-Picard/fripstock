import { BadRequestException } from '@nestjs/common';
import { StatusesService } from './statuses.service';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID, inStock, manager, returned, sold } from '../test/fixtures';

describe('StatusesService', () => {
  let prisma: PrismaMock;
  let service: StatusesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new StatusesService(asPrisma(prisma));
  });

  describe('list', () => {
    it('rend tout atteignable tant qu’aucune flèche n’est tracée', async () => {
      prisma.status.findMany.mockResolvedValue([
        { ...inStock, outgoingTransitions: [] },
        { ...sold, outgoingTransitions: [] },
      ]);

      const statuses = await service.list(manager);

      expect(statuses.every((s) => s.flowDefined === false)).toBe(true);
      expect(statuses[0].allowedTargets).toEqual([sold.id]);
      expect(statuses[1].allowedTargets).toEqual([inStock.id]);
    });

    it('un statut ne se propose jamais lui-même comme cible', async () => {
      prisma.status.findMany.mockResolvedValue([{ ...inStock, outgoingTransitions: [] }]);
      const [status] = await service.list(manager);
      expect(status.allowedTargets).toEqual([]);
    });

    it('suit le graphe dès qu’une seule flèche existe dans l’entreprise', async () => {
      prisma.status.findMany.mockResolvedValue([
        { ...inStock, outgoingTransitions: [{ targetId: sold.id }] },
        { ...sold, outgoingTransitions: [] },
      ]);

      const statuses = await service.list(manager);

      expect(statuses.every((s) => s.flowDefined === true)).toBe(true);
      expect(statuses[0].allowedTargets).toEqual([sold.id]);
      // Le statut sans flèche sortante devient un cul-de-sac, et c'est voulu.
      expect(statuses[1].allowedTargets).toEqual([]);
    });

    it('ne laisse pas fuiter la relation technique des transitions', async () => {
      prisma.status.findMany.mockResolvedValue([{ ...inStock, outgoingTransitions: [] }]);
      const [status] = await service.list(manager);
      expect(status).not.toHaveProperty('outgoingTransitions');
    });

    it('scope la requête sur l’entreprise et trie par ordre puis nom', async () => {
      prisma.status.findMany.mockResolvedValue([]);
      await service.list(manager);
      expect(prisma.status.findMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        include: { outgoingTransitions: { select: { targetId: true } } },
      });
    });
  });

  describe('checkTransition', () => {
    it('laisse tout passer quand l’entreprise n’a tracé aucune flèche', async () => {
      prisma.statusTransition.count.mockResolvedValue(0);
      await expect(
        service.checkTransition(COMPANY_ID, inStock.id, returned.id),
      ).resolves.toBeUndefined();
      expect(prisma.statusTransition.findFirst).not.toHaveBeenCalled();
    });

    it('accepte un passage tracé', async () => {
      prisma.statusTransition.count.mockResolvedValue(5);
      prisma.statusTransition.findFirst.mockResolvedValue({ id: 't1' });
      await expect(
        service.checkTransition(COMPANY_ID, inStock.id, sold.id),
      ).resolves.toBeUndefined();
    });

    it('refuse un passage absent du flux en nommant les deux statuts', async () => {
      prisma.statusTransition.count.mockResolvedValue(5);
      prisma.statusTransition.findFirst.mockResolvedValue(null);
      prisma.status.findUnique
        .mockResolvedValueOnce({ name: 'En stock' })
        .mockResolvedValueOnce({ name: 'Vendu' });
      await expect(service.checkTransition(COMPANY_ID, inStock.id, sold.id)).rejects.toThrow(
        'de « En stock » à « Vendu »',
      );
    });

    it('reste lisible même si un statut a disparu entre-temps', async () => {
      prisma.statusTransition.count.mockResolvedValue(5);
      prisma.statusTransition.findFirst.mockResolvedValue(null);
      prisma.status.findUnique.mockResolvedValue(null);
      await expect(service.checkTransition(COMPANY_ID, 'a', 'b')).rejects.toThrow(
        'de « ? » à « ? »',
      );
    });

    it('cherche la flèche dans l’entreprise, pas globalement', async () => {
      prisma.statusTransition.count.mockResolvedValue(1);
      prisma.statusTransition.findFirst.mockResolvedValue({ id: 't1' });
      await service.checkTransition(COMPANY_ID, 'a', 'b');
      expect(prisma.statusTransition.findFirst).toHaveBeenCalledWith({
        where: { sourceId: 'a', targetId: 'b', source: { companyId: COMPANY_ID } },
        select: { id: true },
      });
    });
  });

  describe('defaults', () => {
    it('rend le statut par défaut de l’entreprise', async () => {
      prisma.status.findFirst.mockResolvedValue(inStock);
      await expect(service.defaults(COMPANY_ID)).resolves.toBe(inStock);
    });

    it('échoue clairement si aucun statut par défaut n’est défini', async () => {
      prisma.status.findFirst.mockResolvedValue(null);
      await expect(service.defaults(COMPANY_ID)).rejects.toThrow(BadRequestException);
      await expect(service.defaults(COMPANY_ID)).rejects.toThrow('Aucun statut par défaut');
    });
  });
});
