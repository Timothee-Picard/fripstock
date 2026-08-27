import { BadRequestException, Injectable } from '@nestjs/common';
import type { CurrentUser } from '../common/types/current-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatusesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste des statuts, avec pour chacun les cibles qu'il peut atteindre.
   *
   * Le front s'en sert pour ne proposer que les changements possibles ; l'API
   * refait la vérification de son côté, l'affichage n'étant qu'un confort.
   */
  async list(currentUser: CurrentUser) {
    const statuses = await this.prisma.status.findMany({
      where: { companyId: currentUser.companyId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { outgoingTransitions: { select: { targetId: true } } },
    });

    // Aucune flèche tracée = flux libre : toutes les cibles sont atteignables.
    const flowDefined = statuses.some((s) => s.outgoingTransitions.length > 0);

    return statuses.map(({ outgoingTransitions, ...status }) => ({
      ...status,
      flowDefined,
      allowedTargets: flowDefined
        ? outgoingTransitions.map((t) => t.targetId)
        : statuses.filter((s) => s.id !== status.id).map((s) => s.id),
    }));
  }

  /**
   * Vérifie qu'un produit peut passer d'un statut à un autre.
   *
   * Tant qu'aucune flèche n'est tracée dans l'entreprise, tout est permis :
   * exiger un graphe vide bloquerait le stock de toutes les entreprises
   * existantes, et un gérant qui oublie une flèche coincerait la sienne.
   */
  async checkTransition(companyId: string, sourceId: string, targetId: string) {
    const total = await this.prisma.statusTransition.count({
      where: { source: { companyId } },
    });
    if (total === 0) return;

    const allowed = await this.prisma.statusTransition.findFirst({
      where: { sourceId, targetId, source: { companyId } },
      select: { id: true },
    });
    if (!allowed) {
      const [source, target] = await Promise.all([
        this.prisma.status.findUnique({ where: { id: sourceId }, select: { name: true } }),
        this.prisma.status.findUnique({ where: { id: targetId }, select: { name: true } }),
      ]);
      throw new BadRequestException(
        `Le flux de votre entreprise n'autorise pas le passage de « ${source?.name ?? '?'} » à « ${target?.name ?? '?'} ».`,
      );
    }
  }

  /** Statut par défaut de l'entreprise, exigé à la création d'un produit. */
  async defaults(companyId: string) {
    const status = await this.prisma.status.findFirst({
      where: { companyId, isDefault: true },
    });
    if (!status) {
      throw new BadRequestException("Aucun statut par défaut n'est défini pour cette entreprise.");
    }
    return status;
  }
}
