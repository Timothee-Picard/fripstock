import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID, manager } from '../test/fixtures';

const cat = (id: string, name: string, parentId: string | null = null) => ({
  id,
  name,
  parentId,
  companyId: COMPANY_ID,
});

describe('CategoriesService', () => {
  let prisma: PrismaMock;
  let service: CategoriesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CategoriesService(asPrisma(prisma));
  });

  describe('list', () => {
    it("scope sur l'entreprise et trie par nom", async () => {
      prisma.category.findMany.mockResolvedValue([]);
      await service.list(manager);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('tree', () => {
    it('reconstruit la hiérarchie en une seule requête', async () => {
      prisma.category.findMany.mockResolvedValue([
        cat('vetements', 'Vêtements'),
        cat('robe', 'Robe', 'vetements'),
        cat('sac', 'Sac'),
      ]);

      const tree = await service.tree(manager);

      expect(prisma.category.findMany).toHaveBeenCalledTimes(1);
      expect(tree.map((n) => n.id)).toEqual(['vetements', 'sac']);
      expect(tree[0].children.map((n) => n.id)).toEqual(['robe']);
      expect(tree[1].children).toEqual([]);
    });

    it('gère plusieurs niveaux', async () => {
      prisma.category.findMany.mockResolvedValue([
        cat('a', 'A'),
        cat('b', 'B', 'a'),
        cat('c', 'C', 'b'),
      ]);
      const tree = await service.tree(manager);
      expect(tree[0].children[0].children[0].id).toBe('c');
    });

    it("remonte à la racine une catégorie dont le parent n'est pas visible", async () => {
      prisma.category.findMany.mockResolvedValue([cat('orpheline', 'Orpheline', 'disparu')]);
      const tree = await service.tree(manager);
      expect(tree.map((n) => n.id)).toEqual(['orpheline']);
    });

    it('rend un arbre vide sans catégorie', async () => {
      prisma.category.findMany.mockResolvedValue([]);
      await expect(service.tree(manager)).resolves.toEqual([]);
    });
  });

  describe('detail', () => {
    it('inclut les sous-catégories', async () => {
      prisma.category.findFirst.mockResolvedValue({ ...cat('a', 'A'), children: [] });
      await service.detail(manager, 'a');
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'a', companyId: COMPANY_ID },
        include: { children: { select: { id: true, name: true } } },
      });
    });

    it('refuse une catégorie hors entreprise', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.detail(manager, 'a')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('crée une racine sans vérifier de parent', async () => {
      prisma.category.create.mockResolvedValue(cat('a', 'A'));
      await service.create(manager, { name: 'A' });
      expect(prisma.category.findFirst).not.toHaveBeenCalled();
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { companyId: COMPANY_ID, name: 'A', parentId: null },
      });
    });

    it("vérifie que le parent appartient bien à l'entreprise", async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      await expect(service.create(manager, { name: 'A', parentId: 'ailleurs' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.category.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('renomme sans toucher au parent', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'a' });
      prisma.category.update.mockResolvedValue(cat('a', 'A2'));
      await service.update(manager, 'a', { name: 'A2' });
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'a' },
        data: { name: 'A2' },
      });
    });

    it('détache une catégorie en la remettant à la racine', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'a' });
      prisma.category.update.mockResolvedValue(cat('a', 'A'));
      await service.update(manager, 'a', { parentId: null });
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'a' },
        data: { parentId: null },
      });
    });

    it("refuse qu'une catégorie soit son propre parent", async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'a' });
      await expect(service.update(manager, 'a', { parentId: 'a' })).rejects.toThrow(
        'ne peut pas être son propre parent',
      );
    });

    it('refuse un rattachement à une de ses sous-catégories', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'a' });
      prisma.category.findMany.mockResolvedValue([
        { id: 'a', parentId: null },
        { id: 'b', parentId: 'a' },
      ]);
      await expect(service.update(manager, 'a', { parentId: 'b' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('accepte un déplacement qui ne crée pas de cycle', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'c' });
      prisma.category.findMany.mockResolvedValue([
        { id: 'a', parentId: null },
        { id: 'b', parentId: 'a' },
        { id: 'c', parentId: null },
      ]);
      prisma.category.update.mockResolvedValue(cat('c', 'C', 'b'));
      await expect(service.update(manager, 'c', { parentId: 'b' })).resolves.toBeDefined();
    });
  });

  describe('delete', () => {
    it('supprime une catégorie vide et sans enfant', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'a' });
      prisma.category.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(0);
      await expect(service.delete(manager, 'a')).resolves.toEqual({ deleted: true });
    });

    it('refuse tant qu’il reste des sous-catégories', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'a' });
      prisma.category.count.mockResolvedValue(2);
      prisma.product.count.mockResolvedValue(0);
      await expect(service.delete(manager, 'a')).rejects.toThrow('2 sous-catégorie(s)');
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('refuse tant qu’il reste des produits', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'a' });
      prisma.category.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(4);
      await expect(service.delete(manager, 'a')).rejects.toThrow(ConflictException);
      await expect(service.delete(manager, 'a')).rejects.toThrow('4 produit(s)');
    });
  });

  describe('attributesOf', () => {
    it('rend les attributs de la catégorie, triés par nom', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'a' });
      prisma.categoryAttribute.findMany.mockResolvedValue([
        { attribute: { id: 'x', name: 'Taille', options: [] } },
        { attribute: { id: 'y', name: 'Couleur', options: [] } },
      ]);
      const attributes = await service.attributesOf(manager, 'a');
      expect(attributes.map((a) => a.name)).toEqual(['Couleur', 'Taille']);
    });
  });

  describe('setAttributes', () => {
    it("remplace la liste d'un coup, dans une transaction", async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'a' });
      prisma.attributeDefinition.count.mockResolvedValue(2);
      prisma.categoryAttribute.findMany.mockResolvedValue([]);

      await service.setAttributes(manager, 'a', { attributeDefinitionIds: ['x', 'y'] });

      expect(prisma.categoryAttribute.deleteMany).toHaveBeenCalledWith({
        where: { categoryId: 'a' },
      });
      expect(prisma.categoryAttribute.createMany).toHaveBeenCalledWith({
        data: [
          { categoryId: 'a', attributeDefinitionId: 'x' },
          { categoryId: 'a', attributeDefinitionId: 'y' },
        ],
      });
    });

    it('accepte une liste vide, qui détache tout', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'a' });
      prisma.categoryAttribute.findMany.mockResolvedValue([]);
      await service.setAttributes(manager, 'a', { attributeDefinitionIds: [] });
      expect(prisma.attributeDefinition.count).not.toHaveBeenCalled();
      expect(prisma.categoryAttribute.deleteMany).toHaveBeenCalled();
      expect(prisma.categoryAttribute.createMany).not.toHaveBeenCalled();
    });

    it("refuse un attribut qui n'appartient pas à l'entreprise", async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'a' });
      prisma.attributeDefinition.count.mockResolvedValue(1);
      await expect(
        service.setAttributes(manager, 'a', { attributeDefinitionIds: ['x', 'pirate'] }),
      ).rejects.toThrow("n'appartient pas à cette entreprise");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
