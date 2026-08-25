import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { TypeAttribut } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { CreerAttributDto, OptionDto } from './dto/creer-attribut.dto';
import type { DefinirCategoriesDto } from './dto/definir-categories.dto';
import type { DefinirOptionsDto } from './dto/definir-options.dto';
import type { ModifierAttributDto } from './dto/modifier-attribut.dto';

/** Seuls ces types portent une liste d'options. */
const TYPES_A_OPTIONS: TypeAttribut[] = ['SELECT', 'MULTISELECT'];

@Injectable()
export class AttributsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bibliothèque globale, identique pour toutes les entreprises. */
  listerTemplates() {
    return this.prisma.attributTemplate.findMany({
      orderBy: { nom: 'asc' },
      include: { options: { orderBy: { ordre: 'asc' } } },
    });
  }

  lister(courant: UtilisateurCourant) {
    return this.prisma.attributDefinition.findMany({
      where: { entrepriseId: courant.entrepriseId },
      orderBy: { nom: 'asc' },
      include: {
        options: { orderBy: { ordre: 'asc' } },
        categories: { select: { categorieId: true } },
      },
    });
  }

  async detail(courant: UtilisateurCourant, id: string) {
    const attribut = await this.prisma.attributDefinition.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
      include: {
        options: { orderBy: { ordre: 'asc' } },
        categories: { select: { categorieId: true } },
      },
    });
    if (!attribut) throw new NotFoundException('Attribut introuvable.');
    return attribut;
  }

  async creer(courant: UtilisateurCourant, dto: CreerAttributDto) {
    await this.refuserNomEnDouble(courant, dto.nom);

    const options = TYPES_A_OPTIONS.includes(dto.type) ? (dto.options ?? []) : [];
    if (TYPES_A_OPTIONS.includes(dto.type) && options.length === 0) {
      throw new BadRequestException(
        `Un attribut de type ${dto.type} a besoin d'au moins une option.`,
      );
    }

    const attribut = await this.prisma.attributDefinition.create({
      data: {
        entrepriseId: courant.entrepriseId,
        nom: dto.nom,
        type: dto.type,
        options: {
          create: options.map((o, ordre) => ({ valeur: o.valeur, ordre })),
        },
      },
    });
    return this.detail(courant, attribut.id);
  }

  /**
   * Clone un template en attribut d'entreprise, options comprises et dans le
   * même ordre. Le clone est ensuite totalement indépendant : le renommer ou
   * modifier ses options n'affecte ni le template ni les autres entreprises.
   */
  async clonerDepuisTemplate(courant: UtilisateurCourant, templateId: string) {
    const template = await this.prisma.attributTemplate.findUnique({
      where: { id: templateId },
      include: { options: { orderBy: { ordre: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Modèle introuvable.');

    await this.refuserNomEnDouble(courant, template.nom);

    const attribut = await this.prisma.attributDefinition.create({
      data: {
        entrepriseId: courant.entrepriseId,
        nom: template.nom,
        type: template.type,
        clonedFromTemplateId: template.id,
        options: {
          create: template.options.map((o) => ({ valeur: o.valeur, ordre: o.ordre })),
        },
      },
    });
    return this.detail(courant, attribut.id);
  }

  async modifier(courant: UtilisateurCourant, id: string, dto: ModifierAttributDto) {
    const attribut = await this.exigerAttribut(courant, id);
    if (dto.nom !== attribut.nom) await this.refuserNomEnDouble(courant, dto.nom);

    await this.prisma.attributDefinition.update({ where: { id }, data: { nom: dto.nom } });
    return this.detail(courant, id);
  }

  async supprimer(courant: UtilisateurCourant, id: string) {
    await this.exigerAttribut(courant, id);

    const [valeurs, optionsUtilisees] = await Promise.all([
      this.prisma.valeurAttribut.count({ where: { attributDefinitionId: id } }),
      this.prisma.produitAttributOption.count({
        where: { option: { attributDefinitionId: id } },
      }),
    ]);
    const utilises = valeurs + optionsUtilisees;
    if (utilises > 0) {
      throw new ConflictException(
        `Cet attribut est renseigné sur ${utilises} produit(s). Videz ces valeurs d'abord.`,
      );
    }

    await this.prisma.attributDefinition.delete({ where: { id } });
    return { supprime: true };
  }

  /**
   * Remplace la liste des options : l'ordre du tableau devient l'ordre
   * affiché, les entrées sans `id` sont créées, celles absentes sont
   * supprimées — sauf si un produit les utilise encore.
   */
  async definirOptions(courant: UtilisateurCourant, id: string, dto: DefinirOptionsDto) {
    const attribut = await this.exigerAttribut(courant, id);
    if (!TYPES_A_OPTIONS.includes(attribut.type)) {
      throw new BadRequestException(`Un attribut de type ${attribut.type} ne porte pas d'options.`);
    }
    if (dto.options.length === 0) {
      throw new BadRequestException('Il faut conserver au moins une option.');
    }

    const existantes = await this.prisma.attributOption.findMany({
      where: { attributDefinitionId: id },
      select: { id: true, valeur: true },
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
    const aSupprimer = existantes.filter((o) => !conserves.has(o.id));

    if (aSupprimer.length > 0) {
      const bloquantes = await this.prisma.produitAttributOption.findMany({
        where: { attributOptionId: { in: aSupprimer.map((o) => o.id) } },
        select: { attributOptionId: true },
        distinct: ['attributOptionId'],
      });
      if (bloquantes.length > 0) {
        const noms = aSupprimer
          .filter((o) => bloquantes.some((b) => b.attributOptionId === o.id))
          .map((o) => o.valeur);
        throw new ConflictException(
          `Ces options sont utilisées par des produits : ${noms.join(', ')}.`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (aSupprimer.length > 0) {
        await tx.attributOption.deleteMany({ where: { id: { in: aSupprimer.map((o) => o.id) } } });
      }
      for (const [ordre, option] of dto.options.entries()) {
        if (option.id) {
          await tx.attributOption.update({
            where: { id: option.id },
            data: { valeur: option.valeur, ordre },
          });
        } else {
          await tx.attributOption.create({
            data: { attributDefinitionId: id, valeur: option.valeur, ordre },
          });
        }
      }
    });

    return this.detail(courant, id);
  }

  /** Remplace la liste des catégories auxquelles l'attribut s'applique. */
  async definirCategories(courant: UtilisateurCourant, id: string, dto: DefinirCategoriesDto) {
    await this.exigerAttribut(courant, id);

    if (dto.categorieIds.length > 0) {
      const valides = await this.prisma.categorie.count({
        where: { id: { in: dto.categorieIds }, entrepriseId: courant.entrepriseId },
      });
      if (valides !== dto.categorieIds.length) {
        throw new BadRequestException("Une catégorie citée n'appartient pas à cette entreprise.");
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.categorieAttribut.deleteMany({ where: { attributDefinitionId: id } });
      if (dto.categorieIds.length > 0) {
        await tx.categorieAttribut.createMany({
          data: dto.categorieIds.map((categorieId) => ({
            categorieId,
            attributDefinitionId: id,
          })),
        });
      }
    });

    return this.detail(courant, id);
  }

  private async exigerAttribut(courant: UtilisateurCourant, id: string) {
    const attribut = await this.prisma.attributDefinition.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
    });
    if (!attribut) throw new NotFoundException('Attribut introuvable.');
    return attribut;
  }

  /** Le schéma impose déjà l'unicité (entrepriseId, nom) : on l'anticipe pour un message clair. */
  private async refuserNomEnDouble(courant: UtilisateurCourant, nom: string) {
    const existant = await this.prisma.attributDefinition.findFirst({
      where: { entrepriseId: courant.entrepriseId, nom },
      select: { id: true },
    });
    if (existant) {
      throw new ConflictException(`Un attribut « ${nom} » existe déjà dans cette entreprise.`);
    }
  }
}

export type { OptionDto };
