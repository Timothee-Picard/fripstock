import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { GerantUniquement } from '../common/decorators/gerant.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { ModifierStatutDto } from './dto/modifier-statut.dto';
import { StatutsService } from './statuts.service';

/**
 * Les six statuts de base et leur flux sont posés à la création de l'entreprise
 * et ne sont ni créés ni supprimés ensuite : le flux les référence, un statut
 * ajouté n'aurait aucune flèche et resterait inatteignable.
 *
 * Le gérant garde le libellé, la couleur et le choix du statut par défaut —
 * c'est justement pour ça que le comportement tient à des flags et non aux
 * noms. Pas de permission fine ici, même traitement que les boutiques ; la
 * lecture reste ouverte, tout le monde a besoin de la liste.
 */
@Controller('statuts')
export class StatutsController {
  constructor(private readonly statuts: StatutsService) {}

  @Get()
  lister(@Utilisateur() courant: UtilisateurCourant) {
    return this.statuts.lister(courant);
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
}
