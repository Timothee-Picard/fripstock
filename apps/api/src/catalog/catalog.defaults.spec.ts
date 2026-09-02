import type { Prisma } from '../generated/prisma/client';
import { asPrisma, createPrismaMock, type PrismaMock } from '../test/prisma-mock';
import { COMPANY_ID } from '../test/fixtures';
import {
  BASE_ATTRIBUTES,
  BASE_CATEGORIES,
  CATEGORY_ROOT,
  createBaseCatalog,
} from './catalog.defaults';

describe('catalogue de départ', () => {
  let prisma: PrismaMock;

  const tx = () => asPrisma(prisma) as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.attributeTemplate.findMany.mockResolvedValue([]);
    prisma.attributeDefinition.create.mockImplementation((args: unknown) =>
      Promise.resolve({ id: `attr-${(args as { data: { name: string } }).data.name}` }),
    );
    prisma.category.create.mockResolvedValue({ id: 'cat-root' });
  });

  describe('cohérence des listes', () => {
    it("ne cite dans une catégorie que des attributs qu'elle déclare", () => {
      const known = new Set(BASE_ATTRIBUTES.map((a) => a.name));
      for (const category of BASE_CATEGORIES) {
        for (const attribute of category.attributes) {
          expect(known).toContain(attribute);
        }
      }
    });

    it('ne déclare pas deux fois le même nom', () => {
      expect(new Set(BASE_ATTRIBUTES.map((a) => a.name)).size).toBe(BASE_ATTRIBUTES.length);
      expect(new Set(BASE_CATEGORIES.map((c) => c.name)).size).toBe(BASE_CATEGORIES.length);
    });

    it("n'utilise la racine comme nom d'aucune catégorie fille", () => {
      expect(BASE_CATEGORIES.map((c) => c.name)).not.toContain(CATEGORY_ROOT);
    });

    it('ne donne des options qu’aux listes de choix', () => {
      for (const attribute of BASE_ATTRIBUTES) {
        if (attribute.options.length > 0) {
          expect(['SELECT', 'MULTISELECT']).toContain(attribute.type);
        }
      }
    });
  });

  describe('createBaseCatalog', () => {
    it('crée un attribut par entrée, avec ses options numérotées', async () => {
      await createBaseCatalog(tx(), COMPANY_ID);

      expect(prisma.attributeDefinition.create).toHaveBeenCalledTimes(BASE_ATTRIBUTES.length);
      const taille = prisma.attributeDefinition.create.mock.calls
        .map((call) => call[0].data as { name: string; options: { create: unknown[] } })
        .find((data) => data.name === 'Taille')!;
      expect(taille.options.create).toEqual([
        { value: 'XS', position: 0 },
        { value: 'S', position: 1 },
        { value: 'M', position: 2 },
        { value: 'L', position: 3 },
        { value: 'XL', position: 4 },
        { value: 'XXL', position: 5 },
      ]);
    });

    it("scope chaque attribut sur l'entreprise passée", async () => {
      await createBaseCatalog(tx(), COMPANY_ID);
      for (const call of prisma.attributeDefinition.create.mock.calls) {
        expect(call[0].data.companyId).toBe(COMPANY_ID);
      }
    });

    it('rattache le clone à son template quand la bibliothèque est seedée', async () => {
      prisma.attributeTemplate.findMany.mockResolvedValue([{ id: 'tpl-couleur', name: 'Couleur' }]);
      await createBaseCatalog(tx(), COMPANY_ID);

      const parNom = new Map(
        prisma.attributeDefinition.create.mock.calls.map((call) => [
          call[0].data.name as string,
          call[0].data.clonedFromTemplateId as string | null,
        ]),
      );
      expect(parNom.get('Couleur')).toBe('tpl-couleur');
      // En production seules les migrations tournent : la bibliothèque est
      // vide, et le catalogue se pose quand même, sans lien.
      expect(parNom.get('Taille')).toBeNull();
    });

    it('crée la racine puis chaque catégorie, celles qui n’en relèvent pas mises à part', async () => {
      await createBaseCatalog(tx(), COMPANY_ID);

      const calls = prisma.category.create.mock.calls.map(
        (call) => call[0].data as { name: string; parentId: string | null },
      );
      expect(calls[0].name).toBe(CATEGORY_ROOT);
      expect(calls).toHaveLength(BASE_CATEGORIES.length + 1);

      const parNom = new Map(calls.map((data) => [data.name, data.parentId]));
      expect(parNom.get('Robe')).toBe('cat-root');
      expect(parNom.get('Sac')).toBeNull();
      expect(parNom.get('Accessoire')).toBeNull();
    });

    it('rattache à chaque catégorie les attributs qui la concernent, et pas les autres', async () => {
      await createBaseCatalog(tx(), COMPANY_ID);

      const parNom = new Map(
        prisma.category.create.mock.calls.map((call) => [
          (call[0].data as { name: string }).name,
          (
            call[0].data as { attributes?: { create: { attributeDefinitionId: string }[] } }
          ).attributes?.create.map((a) => a.attributeDefinitionId) ?? [],
        ]),
      );
      // Un sac n'a pas de taille, un manteau est le seul à être doublé.
      expect(parNom.get('Sac')).not.toContain('attr-Taille');
      expect(parNom.get('Manteau')).toContain('attr-Doublé');
      expect(parNom.get('Robe')).not.toContain('attr-Doublé');
      // La racine ne porte aucun attribut : elle ne sert qu'à ranger.
      expect(parNom.get(CATEGORY_ROOT)).toEqual([]);
    });
  });
});
