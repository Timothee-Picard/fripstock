import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { AttributesService } from './attributes.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { SetCategoriesDto } from './dto/set-categories.dto';
import { SetOptionsDto } from './dto/set-options.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';

/**
 * Les attributs sont définis au niveau Entreprise, jamais par boutique. Comme
 * pour les catégories, les routes d'écriture n'ont pas de `shopId` : le
 * PermissionsGuard applique sa règle du stock central.
 */
@Controller('attributes')
export class AttributesController {
  constructor(private readonly attributes: AttributesService) {}

  // Route littérale déclarée avant @Get(':id'), sinon elle serait avalée par
  // le paramètre.
  @Get('templates')
  templates() {
    return this.attributes.listTemplates();
  }

  @Get()
  list(@AuthUser() currentUser: CurrentUser) {
    return this.attributes.list(currentUser);
  }

  @Get(':id')
  detail(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.attributes.detail(currentUser, id);
  }

  @Post()
  @RequirePermission('attributes.manage')
  create(@AuthUser() currentUser: CurrentUser, @Body() dto: CreateAttributeDto) {
    return this.attributes.create(currentUser, dto);
  }

  @Post('from-template/:templateId')
  @RequirePermission('attributes.manage')
  clone(@AuthUser() currentUser: CurrentUser, @Param('templateId') templateId: string) {
    return this.attributes.cloneFromTemplate(currentUser, templateId);
  }

  @Put(':id')
  @RequirePermission('attributes.manage')
  update(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateAttributeDto,
  ) {
    return this.attributes.update(currentUser, id, dto);
  }

  @Put(':id/options')
  @RequirePermission('attributes.manage')
  setOptions(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: SetOptionsDto,
  ) {
    return this.attributes.setOptions(currentUser, id, dto);
  }

  @Put(':id/categories')
  @RequirePermission('attributes.manage')
  setCategories(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: SetCategoriesDto,
  ) {
    return this.attributes.setCategories(currentUser, id, dto);
  }

  @Delete(':id')
  @RequirePermission('attributes.manage')
  delete(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.attributes.delete(currentUser, id);
  }
}
