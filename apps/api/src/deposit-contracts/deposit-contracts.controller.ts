import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ManagerOnly } from '../common/decorators/manager.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { DepositContractsService } from './deposit-contracts.service';
import { DeadlinesJob } from './deadlines.job';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { AttachProductsDto } from './dto/attach-products.dto';

@Controller('deposit-contracts')
export class DepositContractsController {
  constructor(
    private readonly contracts: DepositContractsService,
    private readonly deadlinesJob: DeadlinesJob,
  ) {}

  @Get()
  @RequirePermission('deposits.manage')
  list(@AuthUser() currentUser: CurrentUser) {
    return this.contracts.list(currentUser);
  }

  @Get(':id')
  @RequirePermission('deposits.manage')
  detail(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.contracts.detail(currentUser, id);
  }

  /**
   * Le contrat en PDF, à imprimer et faire signer.
   *
   * Un dépôt se conclut sur papier : le déposant repart avec la liste de ce
   * qu'il a confié. Même droit que la fiche — qui peut lire le contrat peut
   * l'imprimer, il n'y a rien de plus dedans.
   */
  @Get(':id/pdf')
  @RequirePermission('deposits.manage')
  async pdf(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { fileName, body } = await this.contracts.pdf(currentUser, id);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    return new StreamableFile(body);
  }

  /**
   * Création d'un contrat **et de ses produits** en une passe.
   *
   * D'où les deux permissions : la route crée des produits pour de bon, et
   * `deposits.manage` seule en aurait fait une porte dérobée. Un contrat sans
   * article n'existe de toute façon pas — on saisit les deux d'un coup.
   */
  @Post()
  @RequirePermission('deposits.manage', 'products.manage')
  create(@AuthUser() currentUser: CurrentUser, @Body() dto: CreateContractDto) {
    return this.contracts.create(currentUser, dto);
  }

  /**
   * Déclenche la passe d'échéances à la main. Réservé au gérant : attendre le
   * lendemain pour vérifier qu'une alerte part serait absurde.
   */
  @Post('deadlines')
  @ManagerOnly()
  deadlines() {
    return this.deadlinesJob.run();
  }

  @Post(':id/products')
  @RequirePermission('deposits.manage')
  attach(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: AttachProductsDto,
  ) {
    return this.contracts.attachProducts(currentUser, id, dto);
  }

  @Delete(':id/products/:productId')
  @RequirePermission('deposits.manage')
  detach(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Param('productId') productId: string,
    // En query et non dans le corps : un DELETE qui porte un corps est mal
    // supporté par les clients HTTP.
    @Query('renumber') renumber?: string,
  ) {
    return this.contracts.detachProduct(currentUser, id, productId, renumber === 'true');
  }

  @Put(':id')
  @RequirePermission('deposits.manage')
  update(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contracts.update(currentUser, id, dto);
  }

  @Delete(':id')
  @RequirePermission('deposits.manage')
  delete(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.contracts.delete(currentUser, id);
  }
}
