import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { BoutiqueDepuisRessource } from '../common/decorators/boutique-source.decorator';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { AssignerBoutiqueDto } from './dto/assigner-boutique.dto';
import { ChangerStatutDto } from './dto/changer-statut.dto';
import { CreerProduitDto } from './dto/creer-produit.dto';
import { FiltrerProduitsDto } from './dto/filtrer-produits.dto';
import { ModifierProduitDto } from './dto/modifier-produit.dto';
import { ModifierVenteDto } from './dto/modifier-vente.dto';
import { boutiqueDuProduit, ProduitsService } from './produits.service';

/**
 * Comment le PermissionsGuard retrouve la boutique, route par route :
 *
 * - `GET /produits`, `POST /produits` : `boutiqueId` explicite en query ou dans
 *   le body, sinon stock central.
 * - toutes les routes en `:id` : la boutique se lit sur le produit chargé, via
 *   @BoutiqueDepuisRessource — elle n'est ni dans les params ni dans le body.
 */
@Controller('produits')
export class ProduitsController {
  constructor(private readonly produits: ProduitsService) {}

  @Get()
  @RequirePermission('produits.voir')
  lister(@Utilisateur() courant: UtilisateurCourant, @Query() filtres: FiltrerProduitsDto) {
    return this.produits.lister(courant, filtres);
  }

  // Les routes littérales à venir (/produits/export à l'étape 7) doivent être
  // déclarées ICI, avant @Get(':id') : NestJS matche dans l'ordre et le
  // paramètre avalerait tout le reste.

  @Get(':id')
  @RequirePermission('produits.voir')
  @BoutiqueDepuisRessource('id', boutiqueDuProduit)
  detail(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.produits.detail(courant, id);
  }

  @Post()
  @RequirePermission('produits.creer')
  creer(@Utilisateur() courant: UtilisateurCourant, @Body() dto: CreerProduitDto) {
    return this.produits.creer(courant, dto);
  }

  @Put(':id')
  @RequirePermission('produits.modifier')
  @BoutiqueDepuisRessource('id', boutiqueDuProduit)
  modifier(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: ModifierProduitDto,
  ) {
    return this.produits.modifier(courant, id, dto);
  }

  @Put(':id/assigner-boutique')
  @RequirePermission('produits.modifier')
  @BoutiqueDepuisRessource('id', boutiqueDuProduit)
  assignerBoutique(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: AssignerBoutiqueDto,
  ) {
    return this.produits.assignerBoutique(courant, id, dto);
  }

  /** Corrige une vente déjà enregistrée : prix encaissé, date, commission. */
  @Put(':id/vente')
  @RequirePermission('produits.modifier')
  @BoutiqueDepuisRessource('id', boutiqueDuProduit)
  modifierVente(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: ModifierVenteDto,
  ) {
    return this.produits.modifierVente(courant, id, dto);
  }

  @Put(':id/statut')
  @RequirePermission('produits.changerStatut')
  @BoutiqueDepuisRessource('id', boutiqueDuProduit)
  changerStatut(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: ChangerStatutDto,
  ) {
    return this.produits.changerStatut(courant, id, dto);
  }

  @Delete(':id')
  @RequirePermission('produits.supprimer')
  @BoutiqueDepuisRessource('id', boutiqueDuProduit)
  supprimer(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.produits.supprimer(courant, id);
  }
}
