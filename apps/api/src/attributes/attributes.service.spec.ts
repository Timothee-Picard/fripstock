import { ConflictException, NotFoundException } from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID, manager } from '../test/fixtures';

const couleur = {
  id: 'a1',
  companyId: COMPANY_ID,
  name: 'Couleur',
  type: 'SELECT' as const,
  options: [],
  categories: [],
};

describe('AttributesService', () => {
  let prisma: PrismaMock;
  let service: AttributesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new AttributesService(asPrisma(prisma));
    // `detail` est rappelé à la fin de la plupart des écritures.
    prisma.attributeDefinition.findFirst.mockResolvedValue(couleur);
  });

  describe('listTemplates', () => {
    it("n'est pas scopée : la bibliothèque est globale", async () => {
      prisma.attributeTemplate.findMany.mockResolvedValue([]);
      await service.listTemplates();
      expect(prisma.attributeTemplate.findMany.mock.calls[0][0]).not.toHaveProperty('where');
    });
  });

  describe('list', () => {
    it("scope sur l'entreprise et trie les options par ordre", async () => {
      prisma.attributeDefinition.findMany.mockResolvedValue([]);
      await service.list(manager);
      const args = prisma.attributeDefinition.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ companyId: COMPANY_ID });
      expect(args.include.options.orderBy).toEqual({ position: 'asc' });
    });
  });

  describe('detail', () => {
    it("refuse un attribut d'une autre entreprise", async () => {
      prisma.attributeDefinition.findFirst.mockResolvedValue(null);
      await expect(service.detail(manager, 'a1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('crée un attribut texte, sans option', async () => {
      prisma.attributeDefinition.findFirst.mockResolvedValueOnce(null).mockResolvedValue(couleur);
      prisma.attributeDefinition.create.mockResolvedValue({ id: 'a1' });
      await service.create(manager, { name: 'Matière', type: 'TEXT' });
      expect(prisma.attributeDefinition.create.mock.calls[0][0].data.options.create).toEqual([]);
    });

    it('numérote les options dans l’ordre du tableau', async () => {
      prisma.attributeDefinition.findFirst.mockResolvedValueOnce(null).mockResolvedValue(couleur);
      prisma.attributeDefinition.create.mockResolvedValue({ id: 'a1' });
      await service.create(manager, {
        name: 'Couleur',
        type: 'SELECT',
        options: [{ value: 'Noir' }, { value: 'Beige' }],
      });
      expect(prisma.attributeDefinition.create.mock.calls[0][0].data.options.create).toEqual([
        { value: 'Noir', position: 0 },
        { value: 'Beige', position: 1 },
      ]);
    });

    it('exige au moins une option pour un type à choix', async () => {
      prisma.attributeDefinition.findFirst.mockResolvedValueOnce(null);
      await expect(service.create(manager, { name: 'Couleur', type: 'SELECT' })).rejects.toThrow(
        "besoin d'au moins une option",
      );
    });

    it('ignore les options fournies pour un type qui n’en porte pas', async () => {
      prisma.attributeDefinition.findFirst.mockResolvedValueOnce(null).mockResolvedValue(couleur);
      prisma.attributeDefinition.create.mockResolvedValue({ id: 'a1' });
      await service.create(manager, {
        name: 'Matière',
        type: 'TEXT',
        options: [{ value: 'Cuir' }],
      });
      expect(prisma.attributeDefinition.create.mock.calls[0][0].data.options.create).toEqual([]);
    });

    it('refuse un nom déjà pris dans l’entreprise', async () => {
      prisma.attributeDefinition.findFirst.mockResolvedValue({ id: 'autre' });
      await expect(service.create(manager, { name: 'Couleur', type: 'TEXT' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('cloneFromTemplate', () => {
    const template = {
      id: 't1',
      name: 'Taille',
      type: 'SELECT' as const,
      options: [
        { value: 'S', position: 0 },
        { value: 'M', position: 1 },
      ],
    };

    it('copie nom, type et options en gardant leur ordre', async () => {
      prisma.attributeTemplate.findUnique.mockResolvedValue(template);
      prisma.attributeDefinition.findFirst.mockResolvedValueOnce(null).mockResolvedValue(couleur);
      prisma.attributeDefinition.create.mockResolvedValue({ id: 'a2' });
      await service.cloneFromTemplate(manager, 't1');
      const data = prisma.attributeDefinition.create.mock.calls[0][0].data;
      expect(data.name).toBe('Taille');
      expect(data.clonedFromTemplateId).toBe('t1');
      expect(data.options.create).toEqual([
        { value: 'S', position: 0 },
        { value: 'M', position: 1 },
      ]);
    });

    it('refuse un modèle inexistant', async () => {
      prisma.attributeTemplate.findUnique.mockResolvedValue(null);
      await expect(service.cloneFromTemplate(manager, 't9')).rejects.toThrow('Modèle introuvable.');
    });

    it('refuse de cloner deux fois le même nom', async () => {
      prisma.attributeTemplate.findUnique.mockResolvedValue(template);
      prisma.attributeDefinition.findFirst.mockResolvedValue({ id: 'deja' });
      await expect(service.cloneFromTemplate(manager, 't1')).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('renomme un attribut', async () => {
      prisma.attributeDefinition.findFirst
        .mockResolvedValueOnce(couleur)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(couleur);
      await service.update(manager, 'a1', { name: 'Teinte' });
      expect(prisma.attributeDefinition.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { name: 'Teinte' },
      });
    });

    it('ne cherche pas de doublon quand le nom ne change pas', async () => {
      prisma.attributeDefinition.findFirst.mockResolvedValue(couleur);
      await service.update(manager, 'a1', { name: 'Couleur' });
      expect(prisma.attributeDefinition.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('supprime un attribut inutilisé', async () => {
      prisma.attributeValue.count.mockResolvedValue(0);
      prisma.productAttributeOption.count.mockResolvedValue(0);
      await expect(service.delete(manager, 'a1')).resolves.toEqual({ deleted: true });
    });

    it('refuse tant qu’une valeur est renseignée', async () => {
      prisma.attributeValue.count.mockResolvedValue(3);
      prisma.productAttributeOption.count.mockResolvedValue(0);
      await expect(service.delete(manager, 'a1')).rejects.toThrow('sur 3 produit(s)');
    });

    it('compte aussi les options choisies sur des produits', async () => {
      prisma.attributeValue.count.mockResolvedValue(0);
      prisma.productAttributeOption.count.mockResolvedValue(2);
      await expect(service.delete(manager, 'a1')).rejects.toThrow('sur 2 produit(s)');
    });
  });

  describe('setOptions', () => {
    beforeEach(() => {
      prisma.attributeDefinition.findFirst.mockResolvedValue(couleur);
    });

    it('refuse pour un type qui ne porte pas d’options', async () => {
      prisma.attributeDefinition.findFirst.mockResolvedValue({ ...couleur, type: 'TEXT' });
      await expect(
        service.setOptions(manager, 'a1', { options: [{ value: 'x' }] }),
      ).rejects.toThrow('ne porte pas d');
    });

    it('refuse de vider la liste', async () => {
      await expect(service.setOptions(manager, 'a1', { options: [] })).rejects.toThrow(
        'au moins une option',
      );
    });

    it("refuse un id d'option étranger à l'attribut", async () => {
      prisma.attributeOption.findMany.mockResolvedValue([{ id: 'o1', value: 'Noir' }]);
      await expect(
        service.setOptions(manager, 'a1', { options: [{ id: 'pirate', value: 'x' }] }),
      ).rejects.toThrow("n'appartient pas à cet attribut");
    });

    it('renumérote, crée les nouvelles et supprime les absentes', async () => {
      prisma.attributeOption.findMany.mockResolvedValue([
        { id: 'o1', value: 'Noir' },
        { id: 'o2', value: 'Beige' },
      ]);
      prisma.productAttributeOption.findMany.mockResolvedValue([]);

      await service.setOptions(manager, 'a1', {
        options: [{ id: 'o2', value: 'Beige' }, { value: 'Rouge' }],
      });

      expect(prisma.attributeOption.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['o1'] } },
      });
      expect(prisma.attributeOption.update).toHaveBeenCalledWith({
        where: { id: 'o2' },
        data: { value: 'Beige', position: 0 },
      });
      expect(prisma.attributeOption.create).toHaveBeenCalledWith({
        data: { attributeDefinitionId: 'a1', value: 'Rouge', position: 1 },
      });
    });

    it('refuse de supprimer une option encore choisie sur un produit', async () => {
      prisma.attributeOption.findMany.mockResolvedValue([
        { id: 'o1', value: 'Noir' },
        { id: 'o2', value: 'Beige' },
      ]);
      prisma.productAttributeOption.findMany.mockResolvedValue([{ attributeOptionId: 'o1' }]);
      await expect(
        service.setOptions(manager, 'a1', { options: [{ id: 'o2', value: 'Beige' }] }),
      ).rejects.toThrow('utilisées par des produits : Noir.');
      expect(prisma.attributeOption.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('portée entreprise', () => {
    it.each(['update', 'delete', 'setOptions', 'setCategories'])(
      '%s refuse un attribut d’une autre entreprise',
      async (methode) => {
        prisma.attributeDefinition.findFirst.mockResolvedValue(null);
        const appels: Record<string, () => Promise<unknown>> = {
          update: () => service.update(manager, 'a1', { name: 'x' }),
          delete: () => service.delete(manager, 'a1'),
          setOptions: () => service.setOptions(manager, 'a1', { options: [{ value: 'x' }] }),
          setCategories: () => service.setCategories(manager, 'a1', { categoryIds: [] }),
        };
        await expect(appels[methode]()).rejects.toThrow(NotFoundException);
      },
    );
  });

  describe('setCategories', () => {
    it("remplace les rattachements d'un coup", async () => {
      prisma.category.count.mockResolvedValue(2);
      await service.setCategories(manager, 'a1', { categoryIds: ['c1', 'c2'] });
      expect(prisma.categoryAttribute.deleteMany).toHaveBeenCalledWith({
        where: { attributeDefinitionId: 'a1' },
      });
      expect(prisma.categoryAttribute.createMany).toHaveBeenCalledWith({
        data: [
          { categoryId: 'c1', attributeDefinitionId: 'a1' },
          { categoryId: 'c2', attributeDefinitionId: 'a1' },
        ],
      });
    });

    it('accepte une liste vide, qui détache tout', async () => {
      await service.setCategories(manager, 'a1', { categoryIds: [] });
      expect(prisma.category.count).not.toHaveBeenCalled();
      expect(prisma.categoryAttribute.createMany).not.toHaveBeenCalled();
    });

    it("refuse une catégorie d'une autre entreprise", async () => {
      prisma.category.count.mockResolvedValue(1);
      await expect(
        service.setCategories(manager, 'a1', { categoryIds: ['c1', 'pirate'] }),
      ).rejects.toThrow("n'appartient pas à cette entreprise");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
