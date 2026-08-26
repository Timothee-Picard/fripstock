import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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
import { PaiementDeposantDto } from './dto/paiement-deposant.dto';
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

  /**
   * Export CSV du stock filtré.
   *
   * Déclarée AVANT @Get(':id') : NestJS matche dans l'ordre de déclaration, et
   * le paramètre avalerait « export » s'il venait en premier.
   */
  @Get('export')
  @RequirePermission('export.csv')
  async exporter(
    @Utilisateur() courant: UtilisateurCourant,
    @Query() filtres: FiltrerProduitsDto,
    @Res({ passthrough: true }) reponse: Response,
  ) {
    const csv = await this.produits.exporter(courant, filtres);
    const nom = `stock-${new Date().toISOString().slice(0, 10)}.csv`;
    reponse.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nom}"`,
    });
    return csv;
  }

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

  /** Marque la part du déposant comme réglée, ou revient dessus. */
  @Put(':id/paiement-deposant')
  @RequirePermission('depots.gerer')
  @BoutiqueDepuisRessource('id', boutiqueDuProduit)
  paiementDeposant(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: PaiementDeposantDto,
  ) {
    return this.produits.basculerPaiementDeposant(courant, id, dto.paye);
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
