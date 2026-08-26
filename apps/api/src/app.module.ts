import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AttributesModule } from './attributes/attributes.module';
import { AuthModule } from './auth/auth.module';
import { ShopsModule } from './shops/shops.module';
import { DepositorsModule } from './depositors/depositors.module';
import { DepositContractsModule } from './deposit-contracts/deposit-contracts.module';
import { CategoriesModule } from './categories/categories.module';
import { ManagerGuard } from './common/guards/manager.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { StatsModule } from './stats/stats.module';
import { StatusesModule } from './statuses/statuses.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    ShopsModule,
    CategoriesModule,
    AttributesModule,
    StatusesModule,
    UploadsModule,
    ProductsModule,
    DepositorsModule,
    DepositContractsModule,
    NotificationsModule,
    StatsModule,
    UsersModule,
  ],
  providers: [
    // L'ordre compte : l'authentification pose `request.user`, dont les deux
    // guards suivants dépendent.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ManagerGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
