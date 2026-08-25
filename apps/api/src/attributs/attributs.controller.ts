import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { AttributsService } from './attributs.service';
import { CreerAttributDto } from './dto/creer-attribut.dto';
import { DefinirCategoriesDto } from './dto/definir-categories.dto';
import { DefinirOptionsDto } from './dto/definir-options.dto';
import { ModifierAttributDto } from './dto/modifier-attribut.dto';

/**
 * Les attributs sont définis au niveau Entreprise, jamais par boutique. Comme
 * pour les catégories, les routes d'écriture n'ont pas de `boutiqueId` : le
 * PermissionsGuard applique sa règle du stock central.
 */
@Controller('attributs')
export class AttributsController {
  constructor(private readonly attributs: AttributsService) {}

  // Route littérale déclarée avant @Get(':id'), sinon elle serait avalée par
  // le paramètre.
  @Get('templates')
  templates() {
    return this.attributs.listerTemplates();
  }

  @Get()
  lister(@Utilisateur() courant: UtilisateurCourant) {
    return this.attributs.lister(courant);
  }

  @Get(':id')
  detail(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.attributs.detail(courant, id);
  }

  @Post()
  @RequirePermission('attributs.gerer')
  creer(@Utilisateur() courant: UtilisateurCourant, @Body() dto: CreerAttributDto) {
    return this.attributs.creer(courant, dto);
  }

  @Post('from-template/:templateId')
  @RequirePermission('attributs.gerer')
  cloner(@Utilisateur() courant: UtilisateurCourant, @Param('templateId') templateId: string) {
    return this.attributs.clonerDepuisTemplate(courant, templateId);
  }

  @Put(':id')
  @RequirePermission('attributs.gerer')
  modifier(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: ModifierAttributDto,
  ) {
    return this.attributs.modifier(courant, id, dto);
  }

  @Put(':id/options')
  @RequirePermission('attributs.gerer')
  definirOptions(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: DefinirOptionsDto,
  ) {
    return this.attributs.definirOptions(courant, id, dto);
  }

  @Put(':id/categories')
  @RequirePermission('attributs.gerer')
  definirCategories(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: DefinirCategoriesDto,
  ) {
    return this.attributs.definirCategories(courant, id, dto);
  }

  @Delete(':id')
  @RequirePermission('attributs.gerer')
  supprimer(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.attributs.supprimer(courant, id);
  }
}
