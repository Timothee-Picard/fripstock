import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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

  describe('update', () => {
    it('renomme un statut', async () => {
      prisma.status.findFirst.mockResolvedValueOnce(inStock).mockResolvedValueOnce(null);
      prisma.status.update.mockResolvedValue({ ...inStock, name: 'Au dépôt' });
      await service.update(manager, inStock.id, { name: 'Au dépôt' });
      expect(prisma.status.update).toHaveBeenCalledWith({
        where: { id: inStock.id },
        data: { name: 'Au dépôt' },
      });
    });

    it('refuse un nom déjà pris dans l’entreprise', async () => {
      prisma.status.findFirst.mockResolvedValueOnce(inStock).mockResolvedValueOnce({ id: 'autre' });
      await expect(service.update(manager, inStock.id, { name: 'Vendu' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.status.update).not.toHaveBeenCalled();
    });

    it('ne vérifie pas le doublon quand le nom ne change pas', async () => {
      prisma.status.findFirst.mockResolvedValueOnce(inStock);
      prisma.status.update.mockResolvedValue(inStock);
      await service.update(manager, inStock.id, { name: inStock.name });
      expect(prisma.status.findFirst).toHaveBeenCalledTimes(1);
    });

    it('accepte une modification sans nom, comme la couleur seule', async () => {
      prisma.status.findFirst.mockResolvedValueOnce(inStock);
      prisma.status.update.mockResolvedValue(inStock);
      await service.update(manager, inStock.id, { color: '#000000' });
      expect(prisma.status.findFirst).toHaveBeenCalledTimes(1);
    });

    it('refuse de modifier un statut d’une autre entreprise', async () => {
      prisma.status.findFirst.mockResolvedValue(null);
      await expect(service.update(manager, 'ailleurs', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setDefault', () => {
    it('remet tous les autres à false dans la même transaction', async () => {
      prisma.status.findFirst.mockResolvedValue(sold);
      prisma.status.findMany.mockResolvedValue([]);
      await service.setDefault(manager, sold.id);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.status.updateMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID },
        data: { isDefault: false },
      });
      expect(prisma.status.update).toHaveBeenCalledWith({
        where: { id: sold.id },
        data: { isDefault: true },
      });
    });

    it('refuse un statut d’une autre entreprise', async () => {
      prisma.status.findFirst.mockResolvedValue(null);
      await expect(service.setDefault(manager, 'ailleurs')).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
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
