import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { CategoriesService } from './categories.service';
import { CreerCategorieDto } from './dto/creer-categorie.dto';
import { ModifierCategorieDto } from './dto/modifier-categorie.dto';

/**
 * Les catégories sont définies au niveau Entreprise, jamais par boutique (voir
 * CLAUDE.md). Les routes d'écriture n'ont donc pas de `boutiqueId` : le
 * PermissionsGuard applique sa règle du stock central, la permission est
 * accordée si l'utilisateur la détient sur au moins une de ses boutiques.
 *
 * La lecture n'exige aucune permission fine : tout utilisateur authentifié voit
 * le catalogue de son entreprise, scopé par `entrepriseId` du jeton.
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  lister(@Utilisateur() courant: UtilisateurCourant) {
    return this.categories.lister(courant);
  }

  // Déclarée avant @Get(':id') : NestJS matche dans l'ordre, une route
  // littérale placée après serait avalée par le paramètre.
  @Get('arbre')
  arbre(@Utilisateur() courant: UtilisateurCourant) {
    return this.categories.arbre(courant);
  }

  @Get(':id')
  detail(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.categories.detail(courant, id);
  }

  @Get(':id/attributs')
  attributs(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.categories.attributsDe(courant, id);
  }

  @Post()
  @RequirePermission('categories.gerer')
  creer(@Utilisateur() courant: UtilisateurCourant, @Body() dto: CreerCategorieDto) {
    return this.categories.creer(courant, dto);
  }

  @Put(':id')
  @RequirePermission('categories.gerer')
  modifier(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: ModifierCategorieDto,
  ) {
    return this.categories.modifier(courant, id, dto);
  }

  @Delete(':id')
  @RequirePermission('categories.gerer')
  supprimer(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.categories.supprimer(courant, id);
  }
}
