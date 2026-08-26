import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { ManagerOnly } from '../common/decorators/manager.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { SetAccessDto } from './dto/set-access.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UsersService } from './users.service';

/** Gestion des employés : entièrement réservée au gérant de l'entreprise. */
@Controller('users')
@ManagerOnly()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@AuthUser() currentUser: CurrentUser) {
    return this.users.list(currentUser);
  }

  @Post('invite')
  invite(@AuthUser() currentUser: CurrentUser, @Body() dto: InviteUserDto) {
    return this.users.invite(currentUser, dto);
  }

  @Put(':id/access')
  setAccess(
    @AuthUser() currentUser: CurrentUser,
    @Param('id') id: string,
    @Body() dto: SetAccessDto,
  ) {
    return this.users.setAccess(currentUser, id, dto);
  }

  @Delete(':id')
  delete(@AuthUser() currentUser: CurrentUser, @Param('id') id: string) {
    return this.users.delete(currentUser, id);
  }
}
