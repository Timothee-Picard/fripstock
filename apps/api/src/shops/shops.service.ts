import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CurrentUser } from '../common/types/current-user';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateShopDto } from './dto/create-shop.dto';
import type { UpdateShopDto } from './dto/update-shop.dto';

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Un gérant voit toutes les boutiques de son entreprise ; un employé
   * uniquement celles auxquelles il a un accès.
   */
  list(currentUser: CurrentUser) {
    return this.prisma.shop.findMany({
      where: {
        companyId: currentUser.companyId,
        ...(currentUser.isManager ? {} : { accesses: { some: { userId: currentUser.userId } } }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async detail(currentUser: CurrentUser, id: string) {
    const shop = await this.prisma.shop.findFirst({
      where: {
        id,
        companyId: currentUser.companyId,
        ...(currentUser.isManager ? {} : { accesses: { some: { userId: currentUser.userId } } }),
      },
    });
    if (!shop) throw new NotFoundException('Boutique introuvable.');
    return shop;
  }

  create(currentUser: CurrentUser, dto: CreateShopDto) {
    return this.prisma.shop.create({
      data: { ...dto, companyId: currentUser.companyId },
    });
  }

  async update(currentUser: CurrentUser, id: string, dto: UpdateShopDto) {
    // On vérifie l'appartenance avant d'écrire : un update direct sur `id`
    // laisserait update la boutique d'une autre entreprise.
    await this.requireOwned(currentUser, id);
    return this.prisma.shop.update({ where: { id }, data: dto });
  }

  async delete(currentUser: CurrentUser, id: string) {
    await this.requireOwned(currentUser, id);

    const products = await this.prisma.product.count({ where: { shopId: id } });
    if (products > 0) {
      throw new ConflictException(
        `Cette boutique contient ${products} produit(s). Réassignez-les avant de la supprimer.`,
      );
    }

    await this.prisma.shop.delete({ where: { id } });
    return { deleted: true };
  }

  private async requireOwned(currentUser: CurrentUser, id: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { id, companyId: currentUser.companyId },
    });
    if (!shop) throw new NotFoundException('Boutique introuvable.');
    return shop;
  }
}
