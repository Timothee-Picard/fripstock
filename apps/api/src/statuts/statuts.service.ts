import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { PrismaService } from '../prisma/prisma.service';
import type { CreerStatutDto } from './dto/creer-statut.dto';
import type { EnregistrerFluxDto } from './dto/enregistrer-flux.dto';
import type { ModifierStatutDto } from './dto/modifier-statut.dto';

@Injectable()
export class StatutsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste des statuts, avec pour chacun les cibles qu'il peut atteindre.
   *
   * Le front s'en sert pour ne proposer que les changements possibles ; l'API
   * refait la vérification de son côté, l'affichage n'étant qu'un confort.
   */
  async lister(courant: UtilisateurCourant) {
    const statuts = await this.prisma.statut.findMany({
      where: { entrepriseId: courant.entrepriseId },
      orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
      include: { transitionsSortantes: { select: { cibleId: true } } },
    });

    // Aucune flèche tracée = flux libre : toutes les cibles sont atteignables.
    const fluxDefini = statuts.some((s) => s.transitionsSortantes.length > 0);

    return statuts.map(({ transitionsSortantes, ...statut }) => ({
      ...statut,
      fluxDefini,
      ciblesAutorisees: fluxDefini
        ? transitionsSortantes.map((t) => t.cibleId)
        : statuts.filter((s) => s.id !== statut.id).map((s) => s.id),
    }));
  }

  async creer(courant: UtilisateurCourant, dto: CreerStatutDto) {
    await this.refuserNomEnDouble(courant, dto.nom);

    const derniere = await this.prisma.statut.aggregate({
      where: { entrepriseId: courant.entrepriseId },
      _max: { ordre: true },
    });

    return this.prisma.statut.create({
      data: {
        entrepriseId: courant.entrepriseId,
        nom: dto.nom,
        couleur: dto.couleur ?? '#6b7280',
        ordre: dto.ordre ?? (derniere._max.ordre ?? -1) + 1,
        estVente: dto.estVente ?? false,
        bloqueVente: dto.bloqueVente ?? false,
        sortStock: dto.sortStock ?? false,
        // Jamais par défaut à la création : c'est une action à part, pour que
        // l'unicité reste tenue en un seul endroit.
        estDefaut: false,
      },
    });
  }

  async modifier(courant: UtilisateurCourant, id: string, dto: ModifierStatutDto) {
    const statut = await this.exiger(courant, id);
    if (dto.nom && dto.nom !== statut.nom) await this.refuserNomEnDouble(courant, dto.nom);
    return this.prisma.statut.update({ where: { id }, data: dto });
  }

  /**
   * Désigne le statut attribué automatiquement à un produit à sa création.
   *
   * L'unicité de `estDefaut` par entreprise n'est pas exprimable en index
   * Prisma (un index sur [entrepriseId, estDefaut] interdirait aussi deux
   * `false`) : elle est tenue ici, dans une transaction qui remet tous les
   * autres à `false`. Voir le commentaire du modèle Statut.
   */
  async definirParDefaut(courant: UtilisateurCourant, id: string) {
    await this.exiger(courant, id);

    await this.prisma.$transaction([
      this.prisma.statut.updateMany({
        where: { entrepriseId: courant.entrepriseId },
        data: { estDefaut: false },
      }),
      this.prisma.statut.update({ where: { id }, data: { estDefaut: true } }),
    ]);

    return this.lister(courant);
  }

  async supprimer(courant: UtilisateurCourant, id: string) {
    const statut = await this.exiger(courant, id);

    if (statut.estDefaut) {
      throw new ConflictException(
        'Ce statut est celui par défaut. Désignez-en un autre avant de le supprimer.',
      );
    }

    const produits = await this.prisma.produit.count({ where: { statutId: id } });
    if (produits > 0) {
      throw new ConflictException(
        `Ce statut est porté par ${produits} produit(s). Déplacez-les d'abord.`,
      );
    }

    const historique = await this.prisma.historiqueStatut.count({ where: { statutId: id } });
    if (historique > 0) {
      throw new ConflictException(
        `Ce statut apparaît dans l'historique de ${historique} changement(s) et ne peut plus être supprimé.`,
      );
    }

    await this.prisma.statut.delete({ where: { id } });
    return { supprime: true };
  }

  /**
   * Enregistre le schéma du flux : positions des statuts et flèches autorisées.
   *
   * Remplacement intégral dans une transaction — c'est l'état du canevas au
   * moment où le gérant enregistre, pas une série de modifications.
   */
  async enregistrerFlux(courant: UtilisateurCourant, dto: EnregistrerFluxDto) {
    const statuts = await this.prisma.statut.findMany({
      where: { entrepriseId: courant.entrepriseId },
      select: { id: true },
    });
    const connus = new Set(statuts.map((s) => s.id));

    // Un identifiant inconnu viendrait d'une autre entreprise : on refuse
    // plutôt que de créer une flèche par-dessus la frontière.
    for (const p of dto.positions) {
      if (!connus.has(p.id)) {
        throw new BadRequestException("Un statut cité n'appartient pas à cette entreprise.");
      }
    }
    for (const t of dto.transitions) {
      if (!connus.has(t.sourceId) || !connus.has(t.cibleId)) {
        throw new BadRequestException("Un statut cité n'appartient pas à cette entreprise.");
      }
      if (t.sourceId === t.cibleId) {
        throw new BadRequestException('Un statut ne peut pas mener à lui-même.');
      }
    }

    // Les doublons viendraient de deux flèches superposées sur le canevas.
    const uniques = new Map(dto.transitions.map((t) => [`${t.sourceId}->${t.cibleId}`, t]));

    await this.prisma.$transaction(async (tx) => {
      for (const p of dto.positions) {
        await tx.statut.update({
          where: { id: p.id },
          data: { positionX: p.x, positionY: p.y },
        });
      }
      await tx.transitionStatut.deleteMany({
        where: { source: { entrepriseId: courant.entrepriseId } },
      });
      if (uniques.size > 0) {
        await tx.transitionStatut.createMany({
          data: [...uniques.values()].map((t) => ({
            sourceId: t.sourceId,
            cibleId: t.cibleId,
          })),
        });
      }
    });

    return this.lister(courant);
  }

  /**
   * Vérifie qu'un produit peut passer d'un statut à un autre.
   *
   * Tant qu'aucune flèche n'est tracée dans l'entreprise, tout est permis :
   * exiger un graphe vide bloquerait le stock de toutes les entreprises
   * existantes, et un gérant qui oublie une flèche coincerait la sienne.
   */
  async verifierTransition(entrepriseId: string, sourceId: string, cibleId: string) {
    const total = await this.prisma.transitionStatut.count({
      where: { source: { entrepriseId } },
    });
    if (total === 0) return;

    const autorisee = await this.prisma.transitionStatut.findFirst({
      where: { sourceId, cibleId, source: { entrepriseId } },
      select: { id: true },
    });
    if (!autorisee) {
      const [source, cible] = await Promise.all([
        this.prisma.statut.findUnique({ where: { id: sourceId }, select: { nom: true } }),
        this.prisma.statut.findUnique({ where: { id: cibleId }, select: { nom: true } }),
      ]);
      throw new BadRequestException(
        `Le flux de votre entreprise n'autorise pas le passage de « ${source?.nom ?? '?'} » à « ${cible?.nom ?? '?'} ».`,
      );
    }
  }

  /** Statut par défaut de l'entreprise, exigé à la création d'un produit. */
  async parDefaut(entrepriseId: string) {
    const statut = await this.prisma.statut.findFirst({
      where: { entrepriseId, estDefaut: true },
    });
    if (!statut) {
      throw new BadRequestException("Aucun statut par défaut n'est défini pour cette entreprise.");
    }
    return statut;
  }

  private async exiger(courant: UtilisateurCourant, id: string) {
    const statut = await this.prisma.statut.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
    });
    if (!statut) throw new NotFoundException('Statut introuvable.');
    return statut;
  }

  private async refuserNomEnDouble(courant: UtilisateurCourant, nom: string) {
    const existant = await this.prisma.statut.findFirst({
      where: { entrepriseId: courant.entrepriseId, nom },
      select: { id: true },
    });
    if (existant) throw new ConflictException(`Un statut « ${nom} » existe déjà.`);
  }
}
