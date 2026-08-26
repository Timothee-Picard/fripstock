import type { PrismaService } from '../prisma/prisma.service';

/** Modèles Prisma exposés par le service, avec les méthodes qu'on utilise. */
const MODELS = [
  'company',
  'shop',
  'user',
  'shopAccess',
  'category',
  'attributeDefinition',
  'attributeTemplate',
  'attributeOption',
  'categoryAttribute',
  'status',
  'statusTransition',
  'depositor',
  'depositContract',
  'product',
  'attributeValue',
  'productAttributeOption',
  'statusHistory',
  'notification',
] as const;

const METHODS = [
  'findFirst',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'findUnique',
  'findMany',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
] as const;

export type PrismaMock = {
  [M in (typeof MODELS)[number]]: Record<(typeof METHODS)[number], jest.Mock>;
} & {
  $transaction: jest.Mock;
  $connect: jest.Mock;
  $disconnect: jest.Mock;
};

/**
 * Prisma en double de test.
 *
 * `$transaction` reçoit soit un tableau de promesses (Prisma les exécute en
 * lot), soit un callback auquel il passe un client transactionnel — ici le
 * mock lui-même, ce qui suffit tant qu'on n'observe pas le rollback.
 */
export function createPrismaMock(): PrismaMock {
  const mock = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  } as unknown as PrismaMock;

  for (const model of MODELS) {
    mock[model] = Object.fromEntries(
      METHODS.map((m) => [m, jest.fn()]),
    ) as PrismaMock[typeof model];
  }

  mock.$transaction = jest.fn((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: PrismaMock) => unknown)(mock)
      : Promise.all(arg as Promise<unknown>[]),
  );

  return mock;
}

/** Le mock vu comme un `PrismaService`, pour l'injection dans les services. */
export function asPrisma(mock: PrismaMock): PrismaService {
  return mock as unknown as PrismaService;
}
