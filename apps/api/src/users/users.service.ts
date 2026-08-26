import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { normalizeEmail } from '../common/email';
import { randomBytes } from 'node:crypto';
import { readPermissions, type Permission, type PermissionMap } from '../common/permissions';
import type { CurrentUser } from '../common/types/current-user';
import { PrismaService } from '../prisma/prisma.service';
import type { SetAccessDto } from './dto/set-access.dto';
import type { InviteUserDto } from './dto/invite-user.dto';

const BCRYPT_COST = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(currentUser: CurrentUser) {
    return this.prisma.user.findMany({
      where: { companyId: currentUser.companyId },
      orderBy: [{ isManager: 'desc' }, { lastName: 'asc' }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isManager: true,
        createdAt: true,
        accesses: {
          select: {
            shopId: true,
            permissions: true,
            shop: { select: { name: true } },
          },
        },
      },
    });
  }

  async invite(currentUser: CurrentUser, dto: InviteUserDto) {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email.');
    }

    // Sans mot de passe fourni, on en génère un et on le renvoie une seule
    // fois : il n'est jamais stocké en clair, il faudra le transmettre à
    // l'employé de vive voix.
    const password = dto.password ?? randomBytes(9).toString('base64url');

    const user = await this.prisma.user.create({
      data: {
        companyId: currentUser.companyId,
        email,
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
        firstName: dto.firstName,
        lastName: dto.lastName,
        isManager: false,
      },
      select: { id: true, email: true, firstName: true, lastName: true, isManager: true },
    });

    return {
      ...user,
      temporaryPassword: dto.password ? undefined : password,
    };
  }

  /** Remplace intégralement les accès d'un employé. */
  async setAccess(currentUser: CurrentUser, userId: string, dto: SetAccessDto) {
    const target = await this.findEmployee(currentUser, userId);

    const shopIds = dto.accesses.map((a) => a.shopId);
    if (new Set(shopIds).size !== shopIds.length) {
      throw new BadRequestException('Une même boutique apparaît plusieurs fois.');
    }

    // Les boutiques citées doivent appartenir à l'entreprise du gérant : sinon
    // on donnerait accès à la boutique d'une autre entreprise.
    const valid = await this.prisma.shop.count({
      where: { id: { in: shopIds }, companyId: currentUser.companyId },
    });
    if (valid !== shopIds.length) {
      throw new BadRequestException("Une boutique citée n'appartient pas à cette entreprise.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.shopAccess.deleteMany({ where: { userId: target.id } });
      if (dto.accesses.length > 0) {
        await tx.shopAccess.createMany({
          data: dto.accesses.map((a) => ({
            userId: target.id,
            shopId: a.shopId,
            permissions: enMap(a.permissions),
          })),
        });
      }
    });

    return this.list(currentUser).then((tous) => tous.find((u) => u.id === target.id));
  }

  async delete(currentUser: CurrentUser, userId: string) {
    const target = await this.findEmployee(currentUser, userId);
    await this.prisma.user.delete({ where: { id: target.id } });
    return { deleted: true };
  }

  /**
   * Un gérant ne peut agir que sur les employés de sa propre entreprise, et
   * jamais sur un autre gérant (ni sur lui-même).
   */
  private async findEmployee(currentUser: CurrentUser, userId: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, companyId: currentUser.companyId },
      select: { id: true, isManager: true },
    });
    if (!target) throw new NotFoundException('Utilisateur introuvable.');
    if (target.isManager) {
      throw new BadRequestException("Un gérant n'est pas géré via cette route.");
    }
    return target;
  }
}

/** `['products.view']` → `{ 'products.view': true }`, le format stocké en base. */
function enMap(permissions: Permission[]): PermissionMap {
  const map: PermissionMap = {};
  for (const p of permissions) map[p] = true;
  return readPermissions(map);
}
