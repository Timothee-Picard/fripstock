import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { GerantUniquement } from '../common/decorators/gerant.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { BoutiquesService } from './boutiques.service';
import { CreerBoutiqueDto } from './dto/creer-boutique.dto';
import { ModifierBoutiqueDto } from './dto/modifier-boutique.dto';

/**
 * Créer, modifier ou supprimer une boutique reste un acte de gérant : pas de
 * permission fine ici (voir la section "Permissions" de CLAUDE.md). La lecture,
 * elle, est ouverte à tout utilisateur, filtrée sur ses accès.
 */
@Controller('boutiques')
export class BoutiquesController {
  constructor(private readonly boutiques: BoutiquesService) {}

  @Get()
  lister(@Utilisateur() courant: UtilisateurCourant) {
    return this.boutiques.lister(courant);
  }

  @Get(':id')
  detail(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.boutiques.detail(courant, id);
  }

  @Post()
  @GerantUniquement()
  creer(@Utilisateur() courant: UtilisateurCourant, @Body() dto: CreerBoutiqueDto) {
    return this.boutiques.creer(courant, dto);
  }

  @Put(':id')
  @GerantUniquement()
  modifier(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('id') id: string,
    @Body() dto: ModifierBoutiqueDto,
  ) {
    return this.boutiques.modifier(courant, id, dto);
  }

  @Delete(':id')
  @GerantUniquement()
  supprimer(@Utilisateur() courant: UtilisateurCourant, @Param('id') id: string) {
    return this.boutiques.supprimer(courant, id);
  }
}
