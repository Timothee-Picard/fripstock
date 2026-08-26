import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ManagerOnly } from '../common/decorators/manager.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { ShopsService } from './shops.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

/**
 * Créer, update ou delete une boutique reste un acte de gérant : pas de
 * permission fine ici (voir la section "Permissions" de CLAUDE.md). La lecture,
 * elle, est ouverte à tout utilisateur, filtrée sur ses accès.
 */
@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get()
  list(@AuthUser() currentUser: CurrentUser) {
    return this.shops.list(currentUser);
  }

  @Get(':id')
  detail(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.shops.detail(currentUser, id);
  }

  @Post()
  @ManagerOnly()
  create(@AuthUser() currentUser: CurrentUser, @Body() dto: CreateShopDto) {
    return this.shops.create(currentUser, dto);
  }

  @Put(':id')
  @ManagerOnly()
  update(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateShopDto,
  ) {
    return this.shops.update(currentUser, id, dto);
  }

  @Delete(':id')
  @ManagerOnly()
  delete(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.shops.delete(currentUser, id);
  }
}
