import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
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
  constructor(private readonly depositors: DepositorsService) {}

  @Get()
  @RequirePermission('depositors.manage')
  list(@AuthUser() currentUser: CurrentUser) {
    return this.depositors.list(currentUser);
  }

  @Get(':id')
  @RequirePermission('depositors.manage')
  detail(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.depositors.detail(currentUser, id);
  }

  @Get(':id/products')
  @RequirePermission('depositors.manage')
  products(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.depositors.products(currentUser, id);
  }

  @Get(':id/statement')
  @RequirePermission('depositors.manage')
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
