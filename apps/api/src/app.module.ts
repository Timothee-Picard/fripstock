import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AttributsModule } from './attributs/attributs.module';
import { AuthModule } from './auth/auth.module';
import { BoutiquesModule } from './boutiques/boutiques.module';
import { CategoriesModule } from './categories/categories.module';
import { GerantGuard } from './common/guards/gerant.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProduitsModule } from './produits/produits.module';
import { StatutsModule } from './statuts/statuts.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    BoutiquesModule,
    CategoriesModule,
    AttributsModule,
    StatutsModule,
    UploadsModule,
    ProduitsModule,
    UsersModule,
  ],
  providers: [
    // L'ordre compte : l'authentification pose `request.user`, dont les deux
    // guards suivants dépendent.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: GerantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
