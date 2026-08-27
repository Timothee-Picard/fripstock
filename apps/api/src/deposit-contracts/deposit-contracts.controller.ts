import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
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
