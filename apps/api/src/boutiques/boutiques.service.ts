import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { PrismaService } from '../prisma/prisma.service';
import type { CreerBoutiqueDto } from './dto/creer-boutique.dto';
import type { ModifierBoutiqueDto } from './dto/modifier-boutique.dto';

@Injectable()
export class BoutiquesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Un gérant voit toutes les boutiques de son entreprise ; un employé
   * uniquement celles auxquelles il a un accès.
   */
  lister(courant: UtilisateurCourant) {
    return this.prisma.boutique.findMany({
      where: {
        entrepriseId: courant.entrepriseId,
        ...(courant.estGerant ? {} : { acces: { some: { userId: courant.userId } } }),
      },
      orderBy: { nom: 'asc' },
    });
  }

  async detail(courant: UtilisateurCourant, id: string) {
    const boutique = await this.prisma.boutique.findFirst({
      where: {
        id,
        entrepriseId: courant.entrepriseId,
        ...(courant.estGerant ? {} : { acces: { some: { userId: courant.userId } } }),
      },
    });
    if (!boutique) throw new NotFoundException('Boutique introuvable.');
    return boutique;
  }

  creer(courant: UtilisateurCourant, dto: CreerBoutiqueDto) {
    return this.prisma.boutique.create({
      data: { ...dto, entrepriseId: courant.entrepriseId },
    });
  }

  async modifier(courant: UtilisateurCourant, id: string, dto: ModifierBoutiqueDto) {
    // On vérifie l'appartenance avant d'écrire : un update direct sur `id`
    // laisserait modifier la boutique d'une autre entreprise.
    await this.detailGerant(courant, id);
    return this.prisma.boutique.update({ where: { id }, data: dto });
  }

  async supprimer(courant: UtilisateurCourant, id: string) {
    await this.detailGerant(courant, id);

    const produits = await this.prisma.produit.count({ where: { boutiqueId: id } });
    if (produits > 0) {
      throw new ConflictException(
        `Cette boutique contient ${produits} produit(s). Réassigne-les avant de la supprimer.`,
      );
    }

    await this.prisma.boutique.delete({ where: { id } });
    return { supprime: true };
  }

  private async detailGerant(courant: UtilisateurCourant, id: string) {
    const boutique = await this.prisma.boutique.findFirst({
      where: { id, entrepriseId: courant.entrepriseId },
    });
    if (!boutique) throw new NotFoundException('Boutique introuvable.');
    return boutique;
  }
}
