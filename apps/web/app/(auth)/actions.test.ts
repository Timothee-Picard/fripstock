import { beforeEach, describe, expect, it } from 'vitest';
import {
  ApiError,
  attraperRedirection,
  clearToken,
  form,
  publicApiFetch,
  resetMocks,
  setToken,
} from '@/test/actions';

const { login, logout, register } = await import('./actions');

describe('login', () => {
  beforeEach(() => resetMocks());

  it("envoie email et password — les noms qu'attend l'API", async () => {
    publicApiFetch.mockResolvedValue({ accessToken: 'jeton' });
    await attraperRedirection(login({}, form({ email: 'gerant@test.fr', password: 'fripstock' })));
    expect(publicApiFetch).toHaveBeenCalledWith('/auth/login', {
      email: 'gerant@test.fr',
      password: 'fripstock',
    });
  });

  it('dépose le jeton puis mène au tableau de bord', async () => {
    publicApiFetch.mockResolvedValue({ accessToken: 'jeton' });
    const url = await attraperRedirection(login({}, form({ email: 'a@b.fr', password: 'x' })));
    expect(setToken).toHaveBeenCalledWith('jeton');
    expect(url).toBe('/dashboard');
  });

  it('rend le message de l’API en cas de refus', async () => {
    publicApiFetch.mockRejectedValue(new ApiError(401, 'Email ou mot de passe incorrect.'));
    await expect(login({}, form({ email: 'a@b.fr', password: 'x' }))).resolves.toEqual({
      error: 'Email ou mot de passe incorrect.',
    });
    expect(setToken).not.toHaveBeenCalled();
  });

  it('reste lisible si l’API est injoignable', async () => {
    publicApiFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(login({}, form({ email: 'a@b.fr', password: 'x' }))).resolves.toEqual({
      error: 'Connexion impossible.',
    });
  });

  it('envoie des chaînes vides plutôt que undefined si le formulaire est vide', async () => {
    publicApiFetch.mockResolvedValue({ accessToken: 'j' });
    await attraperRedirection(login({}, form({})));
    expect(publicApiFetch).toHaveBeenCalledWith('/auth/login', { email: '', password: '' });
  });
});

describe('register', () => {
  beforeEach(() => resetMocks());

  const champs = {
    companyName: 'Friperie',
    email: 'gerant@test.fr',
    password: 'motdepasse',
    firstName: 'Camille',
    lastName: 'Durand',
  };

  it('envoie exactement les cinq champs attendus par l’API', async () => {
    publicApiFetch.mockResolvedValue({ accessToken: 'jeton' });
    await attraperRedirection(register({}, form(champs)));
    expect(publicApiFetch).toHaveBeenCalledWith('/auth/register', champs);
  });

  it('rend le message de l’API quand l’email est déjà pris', async () => {
    publicApiFetch.mockRejectedValue(new ApiError(409, 'Un compte existe déjà avec cet email.'));
    await expect(register({}, form(champs))).resolves.toEqual({
      error: 'Un compte existe déjà avec cet email.',
    });
  });

  it('reste lisible sur une panne', async () => {
    publicApiFetch.mockRejectedValue(new Error('boum'));
    await expect(register({}, form(champs))).resolves.toEqual({
      error: 'Inscription impossible.',
    });
  });
});

describe('logout', () => {
  it('efface le jeton et ramène à la connexion', async () => {
    resetMocks();
    expect(await attraperRedirection(logout())).toBe('/login');
    expect(clearToken).toHaveBeenCalled();
  });
});
