import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { PrismaService } from '../prisma/prisma.service';
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
