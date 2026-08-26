import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { GerantUniquement } from '../common/decorators/gerant.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { CreerStatutDto } from './dto/creer-statut.dto';
import { EnregistrerFluxDto } from './dto/enregistrer-flux.dto';
import { ModifierStatutDto } from './dto/modifier-statut.dto';
import { StatutsService } from './statuts.service';

/**
 * Les statuts sont personnalisables **par le gérant** (voir CLAUDE.md) : pas de
 * clé de permission fine ici, même traitement que les boutiques. La lecture
 * reste ouverte, tout le monde a besoin de la liste pour afficher un produit.
 */
@Controller('statuts')
export class StatutsController {
  constructor(private readonly statuts: StatutsService) {}

  @Get()
  lister(@Utilisateur() courant: UtilisateurCourant) {
    return this.statuts.lister(courant);
  }

  /**
   * Enregistre le schéma du flux — positions et flèches — en un seul appel.
   * Route littérale déclarée avant @Put(':id') pour ne pas être avalée.
   */
  @Put('flux')
  @GerantUniquement()
  enregistrerFlux(@Utilisateur() courant: UtilisateurCourant, @Body() dto: EnregistrerFluxDto) {
    return this.statuts.enregistrerFlux(courant, dto);
  }

  @Post()
  @GerantUniquement()
  creer(@Utilisateur() courant: UtilisateurCourant, @Body() dto: CreerStatutDto) {
    return this.statuts.creer(courant, dto);
  }

  @Put(':id')
  @GerantUniquement()
  modifier(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: ModifierStatutDto,
  ) {
    return this.statuts.modifier(courant, id, dto);
  }

  @Put(':id/par-defaut')
  @GerantUniquement()
  definirParDefaut(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.statuts.definirParDefaut(courant, id);
  }

  @Delete(':id')
  @GerantUniquement()
  supprimer(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.statuts.supprimer(courant, id);
  }
}
