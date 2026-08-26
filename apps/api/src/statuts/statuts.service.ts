import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { PrismaService } from '../prisma/prisma.service';
import type { CreerStatutDto } from './dto/creer-statut.dto';
import type { ModifierStatutDto } from './dto/modifier-statut.dto';

@Injectable()
export class StatutsService {
  constructor(private readonly prisma: PrismaService) {}

  lister(courant: UtilisateurCourant) {
    return this.prisma.statut.findMany({
      where: { entrepriseId: courant.entrepriseId },
      orderBy: [{ ordre: 'asc' }, { nom: 'asc' }],
    });
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
