import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { SetAttributesDto } from './dto/set-attributes.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

/**
 * Les catégories sont définies au niveau Entreprise, jamais par boutique (voir
 * CLAUDE.md). Les routes d'écriture n'ont donc pas de `shopId` : le
 * PermissionsGuard applique sa règle du stock central, la permission est
 * accordée si l'utilisateur la détient sur au moins une de ses boutiques.
 *
 * La lecture n'exige aucune permission fine : tout utilisateur authentifié voit
 * le catalogue de son entreprise, scopé par `companyId` du jeton.
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@AuthUser() currentUser: CurrentUser) {
    return this.categories.list(currentUser);
  }

  // Déclarée avant @Get(':id') : NestJS matche dans l'ordre, une route
  // littérale placée après serait avalée par le paramètre.
  @Get('tree')
  tree(@AuthUser() currentUser: CurrentUser) {
    return this.categories.tree(currentUser);
  }

  @Get(':id')
  detail(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.categories.detail(currentUser, id);
  }

  @Get(':id/attributes')
  attributes(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.categories.attributesOf(currentUser, id);
  }

  /**
   * Configure quels attributs sont proposés pour cette catégorie. C'est bien
   * une configuration du catalogue, pas une possession : les valeurs, elles,
   * vivent sur le produit (AttributeValue).
   *
   * Exige `attributes.manage` et non `categories.manage` : c'est la même écriture
   * que `PUT /attributes/:id/categories`, elle doit coûter la même permission.
   */
  @Put(':id/attributes')
  @RequirePermission('attributes.manage')
  setAttributes(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: SetAttributesDto,
  ) {
    return this.categories.setAttributes(currentUser, id, dto);
  }

  @Post()
  @RequirePermission('categories.manage')
  create(@AuthUser() currentUser: CurrentUser, @Body() dto: CreateCategoryDto) {
    return this.categories.create(currentUser, dto);
  }

  @Put(':id')
  @RequirePermission('categories.manage')
  update(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(currentUser, id, dto);
  }

  @Delete(':id')
  @RequirePermission('categories.manage')
  delete(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.categories.delete(currentUser, id);
  }
}
