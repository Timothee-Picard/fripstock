import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentUser } from '../common/types/current-user';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { SetAttributesDto } from './dto/set-attributes.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

export interface CategoryTree {
  id: string;
  name: string;
  parentId: string | null;
  children: CategoryTree[];
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liste plate, triée par nom. */
  list(currentUser: CurrentUser) {
    return this.prisma.category.findMany({
      where: { companyId: currentUser.companyId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Arbre complet, construit en mémoire à partir d'une seule requête : une
   * catégorie hiérarchique n'a jamais assez de niveaux pour justifier une
   * requête récursive, et n récursions coûteraient bien plus cher.
   */
  async tree(currentUser: CurrentUser): Promise<CategoryTree[]> {
    const flat = await this.list(currentUser);

    const byId = new Map<string, CategoryTree>(
      flat.map((c) => [c.id, { id: c.id, name: c.name, parentId: c.parentId, children: [] }]),
    );

    const roots: CategoryTree[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async detail(currentUser: CurrentUser, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, companyId: currentUser.companyId },
      include: { children: { select: { id: true, name: true } } },
    });
    if (!category) throw new NotFoundException('Catégorie introuvable.');
    return category;
  }

  async create(currentUser: CurrentUser, dto: CreateCategoryDto) {
    if (dto.parentId) await this.requireCategory(currentUser, dto.parentId);
    return this.prisma.category.create({
      data: {
        companyId: currentUser.companyId,
        name: dto.name,
        parentId: dto.parentId ?? null,
      },
    });
  }

  async update(currentUser: CurrentUser, id: string, dto: UpdateCategoryDto) {
    await this.requireCategory(currentUser, id);

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('Une catégorie ne peut pas être son propre parent.');
      }
      await this.requireCategory(currentUser, dto.parentId);
      await this.rejectCycle(currentUser, id, dto.parentId);
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      },
    });
  }

  async delete(currentUser: CurrentUser, id: string) {
    await this.requireCategory(currentUser, id);

    const [children, products] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.product.count({ where: { categoryId: id } }),
    ]);

    // Erreur explicite plutôt qu'une cascade silencieuse : le schéma est en
    // Restrict, mais un message clair vaut mieux qu'une contrainte violée.
    if (children > 0) {
      throw new ConflictException(
        `Cette catégorie a ${children} sous-catégorie(s). Déplacez-les ou supprimez-les d'abord.`,
      );
    }
    if (products > 0) {
      throw new ConflictException(
        `Cette catégorie contient ${products} produit(s). Reclassez-les d'abord.`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Attributs applicables à une catégorie. Sert à générer le formulaire produit
   * dynamique de l'étape suivante.
   *
   * L'association est directe, sans héritage : rattacher un attribut à
   * « Vêtements » ne le donne pas à « Robe ». C'est ce que décrit CLAUDE.md
   * (« Sac peut ne pas avoir Taille, Robe l'aura ») et ce que fait le seed.
   */
  async attributesOf(currentUser: CurrentUser, id: string) {
    await this.requireCategory(currentUser, id);
    const links = await this.prisma.categoryAttribute.findMany({
      where: { categoryId: id },
      include: { attribute: { include: { options: { orderBy: { position: 'asc' } } } } },
    });
    return links.map((l) => l.attribute).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Remplace la liste des attributs proposés pour cette catégorie.
   *
   * Opération symétrique de `PUT /attributes/:id/categories` : même table, même
   * effet, donc même permission exigée — sinon l'une deviendrait un moyen de
   * contourner l'autre.
   */
  async setAttributes(currentUser: CurrentUser, id: string, dto: SetAttributesDto) {
    await this.requireCategory(currentUser, id);

    if (dto.attributeDefinitionIds.length > 0) {
      const valid = await this.prisma.attributeDefinition.count({
        where: { id: { in: dto.attributeDefinitionIds }, companyId: currentUser.companyId },
      });
      if (valid !== dto.attributeDefinitionIds.length) {
        throw new BadRequestException("Un attribut cité n'appartient pas à cette entreprise.");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.categoryAttribute.deleteMany({ where: { categoryId: id } });
      if (dto.attributeDefinitionIds.length > 0) {
        await tx.categoryAttribute.createMany({
          data: dto.attributeDefinitionIds.map((attributeDefinitionId) => ({
            categoryId: id,
            attributeDefinitionId,
          })),
        });
      }
    });

    return this.attributesOf(currentUser, id);
  }

  private async requireCategory(currentUser: CurrentUser, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, companyId: currentUser.companyId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Catégorie introuvable.');
    return category;
  }

  /**
   * Interdit de rattacher une catégorie à l'un de ses propres descendants :
   * l'arbre se détacherait en boucle, invisible depuis la racine.
   */
  private async rejectCycle(currentUser: CurrentUser, id: string, newParentId: string) {
    const flat = await this.prisma.category.findMany({
      where: { companyId: currentUser.companyId },
      select: { id: true, parentId: true },
    });
    const parents = new Map(flat.map((c) => [c.id, c.parentId]));

    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === id) {
        throw new BadRequestException(
          'Cette catégorie ne peut pas être rattachée à l’une de ses sous-catégories.',
        );
      }
      cursor = parents.get(cursor) ?? null;
    }
  }
}
