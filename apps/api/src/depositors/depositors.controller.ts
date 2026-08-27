import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../common/decorators/require-permission.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { DepositorsService } from './depositors.service';
import { CreateDepositorDto } from './dto/create-depositor.dto';
import { UpdateDepositorDto } from './dto/update-depositor.dto';

/**
 * Un déposant appartient à l'entreprise, pas à une boutique : il peut avoir des
 * articles dans plusieurs d'entre elles. Les routes n'ont donc pas de
 * `shopId` et tombent dans la règle du stock central du PermissionsGuard.
 */
@Controller('depositors')
export class DepositorsController {
  /*
   * Lire les déposants s'ouvre aussi à `deposits.manage` : on ne peut pas
   * ouvrir un contrat sans choisir le déposant qu'il lie. Écrire reste réservé
   * à `depositors.manage` — gérer des contrats ne donne pas le droit de
   * corriger un IBAN.
   */
  constructor(private readonly depositors: DepositorsService) {}

  @Get()
  @RequireAnyPermission('depositors.manage', 'deposits.manage')
  list(@AuthUser() currentUser: CurrentUser) {
    return this.depositors.list(currentUser);
  }

  @Get(':id')
  @RequireAnyPermission('depositors.manage', 'deposits.manage')
  detail(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.depositors.detail(currentUser, id);
  }

  @Get(':id/products')
  @RequireAnyPermission('depositors.manage', 'deposits.manage')
  products(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.depositors.products(currentUser, id);
  }

  @Get(':id/statement')
  @RequireAnyPermission('depositors.manage', 'deposits.manage')
  statement(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.depositors.statement(currentUser, id);
  }

  @Post()
  @RequirePermission('depositors.manage')
  create(@AuthUser() currentUser: CurrentUser, @Body() dto: CreateDepositorDto) {
    return this.depositors.create(currentUser, dto);
  }

  @Put(':id')
  @RequirePermission('depositors.manage')
  update(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateDepositorDto,
  ) {
    return this.depositors.update(currentUser, id, dto);
  }

  @Delete(':id')
  @RequirePermission('depositors.manage')
  delete(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.depositors.delete(currentUser, id);
  }
}
