import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ShopFromResource } from '../common/decorators/shop-source.decorator';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../common/decorators/require-permission.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { AssignShopDto } from './dto/assign-shop.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateLotDto } from './dto/create-lot.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { SellManyDto } from './dto/sell-many.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { UpdateOnlineDto } from './dto/update-online.dto';
import { RemovalsDoneDto } from './dto/removals-done.dto';
import { DepositorPaymentDto } from './dto/depositor-payment.dto';
import { shopOfProduct, ProductsService } from './products.service';

/**
 * Comment le PermissionsGuard retrouve la boutique, route par route :
 *
 * - `GET /products`, `POST /products` : `shopId` explicite en query ou dans
 *   le body, sinon stock central.
 * - toutes les routes en `:id` : la boutique se lit sur le produit chargé, via
 *   @ShopFromResource — elle n'est ni dans les params ni dans le body.
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission('products.view')
  list(@AuthUser() currentUser: CurrentUser, @Query() filters: FilterProductsDto) {
    return this.products.list(currentUser, filters);
  }

  /**
   * Export CSV du stock filtré.
   *
   * Déclarée AVANT @Get(':id') : NestJS matche dans l'ordre de déclaration, et
   * le paramètre avalerait « export » s'il venait en premier.
   */
  @Get('export')
  @RequirePermission('export.csv')
  async exportCsv(
    @AuthUser() currentUser: CurrentUser,
    @Query() filters: FilterProductsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const csv = await this.products.exportCsv(currentUser, filters);
    const name = `stock-${new Date().toISOString().slice(0, 10)}.csv`;
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
    });
    return csv;
  }

  /**
   * Tous les retraits à faire.
   *
   * Déclarée AVANT `@Get(':id')`, comme l'export : NestJS matche dans l'ordre
   * de déclaration. Aucune boutique n'est visée par l'URL — le service applique
   * les deux périmètres, qui ne sont pas les mêmes selon la corvée.
   */
  @Get('removals')
  @RequireAnyPermission('online.manage', 'products.manage')
  removals(@AuthUser() currentUser: CurrentUser, @Query('search') search?: string) {
    return this.products.listRemovals(currentUser, search);
  }

  @Get(':id')
  @RequirePermission('products.view')
  @ShopFromResource('id', shopOfProduct)
  detail(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.products.detail(currentUser, id);
  }

  @Post()
  @RequirePermission('products.manage')
  create(@AuthUser() currentUser: CurrentUser, @Body() dto: CreateProductDto) {
    return this.products.create(currentUser, dto);
  }

  /**
   * Achat en lot : un prix payé, plusieurs articles.
   *
   * Déclarée avant `@Put(':id')` sans ambiguïté possible — c'est un POST sur un
   * chemin littéral. Aucune boutique n'est visée par l'URL : la règle du stock
   * central s'applique, comme pour la création d'un produit.
   */
  @Post('lot')
  @RequirePermission('products.manage')
  createLot(@AuthUser() currentUser: CurrentUser, @Body() dto: CreateLotDto) {
    return this.products.createLot(currentUser, dto);
  }

  /**
   * Vente rapide : plusieurs articles d'un coup, au comptoir ou en ligne.
   *
   * Mêmes droits qu'un changement de statut à l'unité, puisque c'est
   * exactement ce qu'elle fait — en série. `online.manage` y donne accès pour
   * la même raison qu'à l'unité, et le service le borne aux statuts de vente
   * en ligne, article par article. Aucune boutique n'est visée par l'URL : le
   * service vérifie aussi l'accès article par article.
   */
  @Post('sale')
  @RequireAnyPermission('products.changeStatus', 'online.manage')
  sellMany(@AuthUser() currentUser: CurrentUser, @Body() dto: SellManyDto) {
    return this.products.sellMany(currentUser, dto);
  }

  /**
   * « Retrait effectué » sur plusieurs articles d'un coup.
   *
   * Déclarée AVANT `@Put(':id')`, comme l'export l'est avant `@Get(':id')` :
   * NestJS matche dans l'ordre de déclaration, et le paramètre avalerait
   * « removals-done » s'il venait en premier. Aucune boutique n'est visée par
   * l'URL — le service vérifie l'accès article par article, comme pour la
   * vente en lot.
   */
  @Put('removals-done')
  @RequireAnyPermission('online.manage', 'products.manage')
  removalsDone(@AuthUser() currentUser: CurrentUser, @Body() dto: RemovalsDoneDto) {
    return this.products.markRemovalsDone(currentUser, dto);
  }

  @Put(':id')
  @RequirePermission('products.manage')
  @ShopFromResource('id', shopOfProduct)
  update(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(currentUser, id, dto);
  }

  @Put(':id/assign-shop')
  @RequirePermission('products.manage')
  @ShopFromResource('id', shopOfProduct)
  assignShop(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: AssignShopDto,
  ) {
    return this.products.assignShop(currentUser, id, dto);
  }

  /** Corrige une vente déjà enregistrée : prix encaissé, date, commission. */
  @Put(':id/sale')
  @RequirePermission('products.manage')
  @ShopFromResource('id', shopOfProduct)
  updateSale(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
  ) {
    return this.products.updateSale(currentUser, id, dto);
  }

  /** Marque la part du déposant comme réglée, ou revient dessus. */
  @Put(':id/depositor-payment')
  @RequirePermission('deposits.manage')
  @ShopFromResource('id', shopOfProduct)
  depositorPayment(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: DepositorPaymentDto,
  ) {
    return this.products.toggleDepositorPayment(currentUser, id, dto.paid);
  }

  /**
   * Publie l'article sur le site, ou l'en retire.
   *
   * Route à part et droit à part : une personne qui ne gère que la vente en
   * ligne doit pouvoir publier sans pouvoir modifier le vêtement. Passer par
   * `PUT /products/:id` lui aurait demandé `products.manage`, qui ouvre aussi
   * le nom, la description et le prix boutique.
   */
  @Put(':id/online')
  @RequirePermission('online.manage')
  @ShopFromResource('id', shopOfProduct)
  setOnline(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateOnlineDto,
  ) {
    return this.products.setOnline(currentUser, id, dto);
  }

  /**
   * « Retrait effectué » sur l'autre canal, après une vente.
   *
   * Les deux droits l'ouvrent parce que la corvée change de main selon le
   * sens : dépublier une annonce est un travail web, décrocher un vêtement du
   * portant est un travail de boutique.
   */
  @Put(':id/removal-done')
  @RequireAnyPermission('online.manage', 'products.manage')
  @ShopFromResource('id', shopOfProduct)
  removalDone(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.products.markRemovalDone(currentUser, id);
  }

  /**
   * Changement de statut, vente comprise.
   *
   * Deux droits l'ouvrent, mais pas au même périmètre : `products.changeStatus`
   * permet tout, `online.manage` seulement les statuts de vente en ligne. Le
   * garde ne peut pas faire cette distinction — le statut visé est dans le
   * corps de la requête, pas dans l'URL — donc le service la refait.
   */
  @Put(':id/status')
  @RequireAnyPermission('products.changeStatus', 'online.manage')
  @ShopFromResource('id', shopOfProduct)
  changeStatus(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.products.changeStatus(currentUser, id, dto);
  }

  @Delete(':id')
  @RequirePermission('products.delete')
  @ShopFromResource('id', shopOfProduct)
  delete(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.products.delete(currentUser, id);
  }
}
