describe('JwtStrategy', () => {
  const SECRET = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.JWT_SECRET = SECRET;
    jest.resetModules();
  });

  // `require` et non `import` : on veut recharger le module après avoir changé
  // l'environnement, et l'import dynamique d'ESM n'est pas disponible sous Jest.
  function load() {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('./jwt.strategy') as typeof import('./jwt.strategy')).JwtStrategy;
  }

  it('refuse de démarrer sans JWT_SECRET — mieux vaut ne pas démarrer du tout', () => {
    delete process.env.JWT_SECRET;
    const JwtStrategy = load();
    expect(() => new JwtStrategy()).toThrow('JWT_SECRET manquante');
  });

  it('transforme la charge du jeton en utilisateur courant', () => {
    process.env.JWT_SECRET = 'secret-de-test';
    const JwtStrategy = load();
    expect(new JwtStrategy().validate({ sub: 'u1', companyId: 'c1', isManager: true })).toEqual({
      userId: 'u1',
      companyId: 'c1',
      isManager: true,
    });
  });

  it('force isManager à un booléen : une valeur douteuse ne donne pas les pleins droits', () => {
    process.env.JWT_SECRET = 'secret-de-test';
    const JwtStrategy = load();
    expect(
      new JwtStrategy().validate({ sub: 'u1', companyId: 'c1', isManager: 'oui' as never }),
    ).toEqual({ userId: 'u1', companyId: 'c1', isManager: false });
  });

  it.each([
    ['sans sub', { sub: '', companyId: 'c1', isManager: false }],
    ['sans companyId', { sub: 'u1', companyId: '', isManager: false }],
  ])('rejette un jeton %s', (_titre, payload) => {
    process.env.JWT_SECRET = 'secret-de-test';
    const JwtStrategy = load();
    // On compare le message et non la classe : `jest.resetModules()` recharge
    // @nestjs/common, et les deux UnauthorizedException ne sont plus la même.
    expect(() => new JwtStrategy().validate(payload)).toThrow('Jeton invalide.');
  });
});
