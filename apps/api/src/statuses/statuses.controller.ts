import { Controller, Get } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { StatusesService } from './statuses.service';

/**
 * Les statuts et leur flux sont posés à la création de l'entreprise et ne
 * bougent plus : ni créés, ni supprimés, ni renommés. Ce sont des rouages
 * internes — c'est le comportement porté par leurs flags qui compte, pas leur
 * libellé, et aucun écran ne les expose.
 *
 * Seule la lecture subsiste, ouverte à tout utilisateur de l'entreprise : la
 * liste des produits, leur fiche et leur changement de statut en ont besoin.
 */
@Controller('statuses')
export class StatusesController {
  constructor(private readonly statuses: StatusesService) {}

  @Get()
  list(@AuthUser() currentUser: CurrentUser) {
    return this.statuses.list(currentUser);
  }
}
