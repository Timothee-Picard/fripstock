import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentUser } from '../common/types/current-user';
import { AttributeType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAttributeDto, OptionDto } from './dto/create-attribute.dto';
import type { SetCategoriesDto } from './dto/set-categories.dto';
import type { SetOptionsDto } from './dto/set-options.dto';
import type { UpdateAttributeDto } from './dto/update-attribute.dto';

/** Seuls ces types portent une liste d'options. */
const TYPES_A_OPTIONS: AttributeType[] = ['SELECT', 'MULTISELECT'];

@Injectable()
export class AttributesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bibliothèque globale, identique pour toutes les entreprises. */
  listTemplates() {
    return this.prisma.attributeTemplate.findMany({
      orderBy: { name: 'asc' },
      include: { options: { orderBy: { position: 'asc' } } },
    });
  }

  list(currentUser: CurrentUser) {
    return this.prisma.attributeDefinition.findMany({
      where: { companyId: currentUser.companyId },
      orderBy: { name: 'asc' },
      include: {
        options: { orderBy: { position: 'asc' } },
        categories: { select: { categoryId: true } },
      },
    });
  }

  async detail(currentUser: CurrentUser, id: string) {
    const attribute = await this.prisma.attributeDefinition.findFirst({
      where: { id, companyId: currentUser.companyId },
      include: {
        options: { orderBy: { position: 'asc' } },
        categories: { select: { categoryId: true } },
      },
    });
    if (!attribute) throw new NotFoundException('Attribut introuvable.');
    return attribute;
  }

  async create(currentUser: CurrentUser, dto: CreateAttributeDto) {
    await this.rejectDuplicateName(currentUser, dto.name);

    const options = TYPES_A_OPTIONS.includes(dto.type) ? (dto.options ?? []) : [];
    if (TYPES_A_OPTIONS.includes(dto.type) && options.length === 0) {
      throw new BadRequestException(
        `Un attribut de type ${dto.type} a besoin d'au moins une option.`,
      );
    }

    const attribute = await this.prisma.attributeDefinition.create({
      data: {
        companyId: currentUser.companyId,
        name: dto.name,
        type: dto.type,
        options: {
          create: options.map((o, position) => ({ value: o.value, position })),
        },
      },
    });
    return this.detail(currentUser, attribute.id);
  }

  /**
   * Clone un template en attribut d'entreprise, options comprises et dans le
   * même ordre. Le clone est ensuite totalement indépendant : le renommer ou
   * update ses options n'affecte ni le template ni les autres entreprises.
   */
  async cloneFromTemplate(currentUser: CurrentUser, templateId: string) {
    const template = await this.prisma.attributeTemplate.findUnique({
      where: { id: templateId },
      include: { options: { orderBy: { position: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Modèle introuvable.');

    await this.rejectDuplicateName(currentUser, template.name);

    const attribute = await this.prisma.attributeDefinition.create({
      data: {
        companyId: currentUser.companyId,
        name: template.name,
        type: template.type,
        clonedFromTemplateId: template.id,
        options: {
          create: template.options.map((o) => ({ value: o.value, position: o.position })),
        },
      },
    });
    return this.detail(currentUser, attribute.id);
  }

  async update(currentUser: CurrentUser, id: string, dto: UpdateAttributeDto) {
    const attribute = await this.requireAttribute(currentUser, id);
    if (dto.name !== attribute.name) await this.rejectDuplicateName(currentUser, dto.name);

    await this.prisma.attributeDefinition.update({ where: { id }, data: { name: dto.name } });
    return this.detail(currentUser, id);
  }

  async delete(currentUser: CurrentUser, id: string) {
    await this.requireAttribute(currentUser, id);

    const [values, optionsUtilisees] = await Promise.all([
      this.prisma.attributeValue.count({ where: { attributeDefinitionId: id } }),
      this.prisma.productAttributeOption.count({
        where: { option: { attributeDefinitionId: id } },
      }),
    ]);
    const utilises = values + optionsUtilisees;
    if (utilises > 0) {
      throw new ConflictException(
        `Cet attribut est renseigné sur ${utilises} produit(s). Videz ces valeurs d'abord.`,
      );
    }

    await this.prisma.attributeDefinition.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Remplace la liste des options : l'ordre du tableau devient l'ordre
   * affiché, les entrées sans `id` sont créées, celles absentes sont
   * supprimées — sauf si un produit les utilise encore.
   */
  async setOptions(currentUser: CurrentUser, id: string, dto: SetOptionsDto) {
    const attribute = await this.requireAttribute(currentUser, id);
    if (!TYPES_A_OPTIONS.includes(attribute.type)) {
      throw new BadRequestException(
        `Un attribut de type ${attribute.type} ne porte pas d'options.`,
      );
    }
    if (dto.options.length === 0) {
      throw new BadRequestException('Il faut conserver au moins une option.');
    }

    const existantes = await this.prisma.attributeOption.findMany({
      where: { attributeDefinitionId: id },
      select: { id: true, value: true },
    });
    const idsExistants = new Set(existantes.map((o) => o.id));

    // Un id inconnu viendrait d'un autre attribut, voire d'une autre
    // entreprise : on refuse plutôt que de le rattacher silencieusement.
    for (const option of dto.options) {
      if (option.id && !idsExistants.has(option.id)) {
        throw new BadRequestException("Une option citée n'appartient pas à cet attribut.");
      }
    }

    const conserves = new Set(dto.options.map((o) => o.id).filter(Boolean) as string[]);
    const aDelete = existantes.filter((o) => !conserves.has(o.id));

    if (aDelete.length > 0) {
      const bloquantes = await this.prisma.productAttributeOption.findMany({
        where: { attributeOptionId: { in: aDelete.map((o) => o.id) } },
        select: { attributeOptionId: true },
        distinct: ['attributeOptionId'],
      });
      if (bloquantes.length > 0) {
        const noms = aDelete
          .filter((o) => bloquantes.some((b) => b.attributeOptionId === o.id))
          .map((o) => o.value);
        throw new ConflictException(
          `Ces options sont utilisées par des produits : ${noms.join(', ')}.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (aDelete.length > 0) {
        await tx.attributeOption.deleteMany({ where: { id: { in: aDelete.map((o) => o.id) } } });
      }
      for (const [position, option] of dto.options.entries()) {
        if (option.id) {
          await tx.attributeOption.update({
            where: { id: option.id },
            data: { value: option.value, position },
          });
        } else {
          await tx.attributeOption.create({
            data: { attributeDefinitionId: id, value: option.value, position },
          });
        }
      }
    });

    return this.detail(currentUser, id);
  }

  /** Remplace la liste des catégories auxquelles l'attribut s'applique. */
  async setCategories(currentUser: CurrentUser, id: string, dto: SetCategoriesDto) {
    await this.requireAttribute(currentUser, id);

    if (dto.categoryIds.length > 0) {
      const valid = await this.prisma.category.count({
        where: { id: { in: dto.categoryIds }, companyId: currentUser.companyId },
      });
      if (valid !== dto.categoryIds.length) {
        throw new BadRequestException("Une catégorie citée n'appartient pas à cette entreprise.");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.categoryAttribute.deleteMany({ where: { attributeDefinitionId: id } });
      if (dto.categoryIds.length > 0) {
        await tx.categoryAttribute.createMany({
          data: dto.categoryIds.map((categoryId) => ({
            categoryId,
            attributeDefinitionId: id,
          })),
        });
      }
    });

    return this.detail(currentUser, id);
  }

  private async requireAttribute(currentUser: CurrentUser, id: string) {
    const attribute = await this.prisma.attributeDefinition.findFirst({
      where: { id, companyId: currentUser.companyId },
    });
    if (!attribute) throw new NotFoundException('Attribut introuvable.');
    return attribute;
  }

  /** Le schéma impose déjà l'unicité (companyId, nom) : on l'anticipe pour un message clair. */
  private async rejectDuplicateName(currentUser: CurrentUser, name: string) {
    const existing = await this.prisma.attributeDefinition.findFirst({
      where: { companyId: currentUser.companyId, name },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Un attribut « ${name} » existe déjà dans cette entreprise.`);
    }
  }
}

export type { OptionDto };
