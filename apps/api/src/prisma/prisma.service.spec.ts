describe('PrismaService', () => {
  const URL = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = URL;
    jest.resetModules();
  });

  function load() {
    jest.resetModules();
    jest.doMock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));
    jest.doMock('../generated/prisma/client', () => ({
      PrismaClient: class {
        $connect = jest.fn().mockResolvedValue(undefined);
        $disconnect = jest.fn().mockResolvedValue(undefined);
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('./prisma.service') as typeof import('./prisma.service')).PrismaService;
  }

  it('refuse de démarrer sans DATABASE_URL', () => {
    delete process.env.DATABASE_URL;
    const PrismaService = load();
    expect(() => new PrismaService()).toThrow('DATABASE_URL manquante');
  });

  it('ouvre la connexion au démarrage du module', async () => {
    process.env.DATABASE_URL = 'postgresql://test';
    const service = new (load())();
    await service.onModuleInit();
    expect(service.$connect).toHaveBeenCalled();
  });

  it('ferme la connexion à l’arrêt', async () => {
    process.env.DATABASE_URL = 'postgresql://test';
    const service = new (load())();
    await service.onModuleDestroy();
    expect(service.$disconnect).toHaveBeenCalled();
  });
});
