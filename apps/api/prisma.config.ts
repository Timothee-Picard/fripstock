import { defineConfig, env } from 'prisma/config';

// Prisma 7 : l'URL de connexion ne peut plus vivre dans schema.prisma. Elle est
// lue ici pour les commandes de migration, et passée séparément au client via
// un adaptateur de driver (voir prisma/seed.ts et le PrismaService).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
    // Base jetable utilisée par `prisma migrate diff` pour rejouer les
    // migrations. Lue via process.env et non env() : elle est facultative,
    // et env() lèverait si elle manquait.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    seed: 'npm run db:seed',
  },
});
