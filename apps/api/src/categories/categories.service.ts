import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { PrismaService } from '../prisma/prisma.service';
import type { CreerCategorieDto } from './dto/creer-categorie.dto';
import type { ModifierCategorieDto } from './dto/modifier-categorie.dto';

export interface CategorieArbre {
  id: string;
  nom: string;
  parentId: string | null;
  enfants: CategorieArbre[];
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liste plate, triée par nom. */
  lister(courant: UtilisateurCourant) {
    return this.prisma.categorie.findMany({
      where: { entrepriseId: courant.entrepriseId },
      orderBy: { nom: 'asc' },
    });
  }

  /**
   * Arbre complet, construit en mémoire à partir d'une seule requête : une
   * catégorie hiérarchique n'a jamais assez de niveaux pour justifier une
   * requête récursive, et n récursions coûteraient bien plus cher.
   */
  async arbre(courant: UtilisateurCourant): Promise<CategorieArbre[]> {
    const plates = await this.lister(courant);

    const parId = new Map<string, CategorieArbre>(
      plates.map((c) => [c.id, { id: c.id, nom: c.nom, parentId: c.parentId, enfants: [] }]),
    );

    const racines: CategorieArbre[] = [];
    for (const noeud of parId.values()) {
      const parent = noeud.parentId ? parId.get(noeud.parentId) : undefined;
      if (parent) parent.enfants.push(noeud);
      else racines.push(noeud);
    }
    return racines;
  }

  async detail(courant: UtilisateurCourant, id: string) {
    const categorie = await this.prisma.categorie.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
      include: { enfants: { select: { id: true, nom: true } } },
    });
    if (!categorie) throw new NotFoundException('Catégorie introuvable.');
    return categorie;
  }

  async creer(courant: UtilisateurCourant, dto: CreerCategorieDto) {
    if (dto.parentId) await this.exigerCategorie(courant, dto.parentId);
    return this.prisma.categorie.create({
      data: {
        entrepriseId: courant.entrepriseId,
        nom: dto.nom,
        parentId: dto.parentId ?? null,
      },
    });
  }

  async modifier(courant: UtilisateurCourant, id: string, dto: ModifierCategorieDto) {
    await this.exigerCategorie(courant, id);

    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('Une catégorie ne peut pas être son propre parent.');
      }
      await this.exigerCategorie(courant, dto.parentId);
      await this.refuserCycle(courant, id, dto.parentId);
    }

    return this.prisma.categorie.update({
      where: { id },
      data: {
        ...(dto.nom !== undefined ? { nom: dto.nom } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      },
    });
  }

  async supprimer(courant: UtilisateurCourant, id: string) {
    await this.exigerCategorie(courant, id);

    const [enfants, produits] = await Promise.all([
      this.prisma.categorie.count({ where: { parentId: id } }),
      this.prisma.produit.count({ where: { categorieId: id } }),
    ]);

    // Erreur explicite plutôt qu'une cascade silencieuse : le schéma est en
    // Restrict, mais un message clair vaut mieux qu'une contrainte violée.
    if (enfants > 0) {
      throw new ConflictException(
        `Cette catégorie a ${enfants} sous-catégorie(s). Déplacez-les ou supprimez-les d'abord.`,
      );
    }
    if (produits > 0) {
      throw new ConflictException(
        `Cette catégorie contient ${produits} produit(s). Reclassez-les d'abord.`,
      );
    }

    await this.prisma.categorie.delete({ where: { id } });
    return { supprime: true };
  }

  /**
   * Attributs applicables à une catégorie. Sert à générer le formulaire produit
   * dynamique de l'étape suivante.
   *
   * L'association est directe, sans héritage : rattacher un attribut à
   * « Vêtements » ne le donne pas à « Robe ». C'est ce que décrit CLAUDE.md
   * (« Sac peut ne pas avoir Taille, Robe l'aura ») et ce que fait le seed.
   */
  async attributsDe(courant: UtilisateurCourant, id: string) {
    await this.exigerCategorie(courant, id);
    const liens = await this.prisma.categorieAttribut.findMany({
      where: { categorieId: id },
      include: { attribut: { include: { options: { orderBy: { ordre: 'asc' } } } } },
    });
    return liens.map((l) => l.attribut).sort((a, b) => a.nom.localeCompare(b.nom));
  }

  private async exigerCategorie(courant: UtilisateurCourant, id: string) {
    const categorie = await this.prisma.categorie.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
      select: { id: true },
    });
    if (!categorie) throw new NotFoundException('Catégorie introuvable.');
    return categorie;
  }

  /**
   * Interdit de rattacher une catégorie à l'un de ses propres descendants :
   * l'arbre se détacherait en boucle, invisible depuis la racine.
   */
  private async refuserCycle(courant: UtilisateurCourant, id: string, nouveauParentId: string) {
    const plates = await this.prisma.categorie.findMany({
      where: { entrepriseId: courant.entrepriseId },
      select: { id: true, parentId: true },
    });
    const parents = new Map(plates.map((c) => [c.id, c.parentId]));

    let curseur: string | null = nouveauParentId;
    while (curseur) {
      if (curseur === id) {
        throw new BadRequestException(
          'Cette catégorie ne peut pas être rattachée à l’une de ses sous-catégories.',
        );
      }
      curseur = parents.get(curseur) ?? null;
    }
  }
}
