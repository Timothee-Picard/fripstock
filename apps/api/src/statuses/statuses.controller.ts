import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ManagerOnly } from '../common/decorators/manager.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { UpdateStatusDto } from './dto/update-status.dto';
import { StatusesService } from './statuses.service';

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
@Controller('statuses')
export class StatusesController {
  constructor(private readonly statuses: StatusesService) {}

  @Get()
  list(@AuthUser() currentUser: CurrentUser) {
    return this.statuses.list(currentUser);
  }

  @Put(':id')
  @ManagerOnly()
  update(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.statuses.update(currentUser, id, dto);
  }

  @Put(':id/default')
  @ManagerOnly()
  setDefault(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.statuses.setDefault(currentUser, id);
  }
}
