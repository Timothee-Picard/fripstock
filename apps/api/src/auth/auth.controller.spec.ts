import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import { prefix, route } from '../test/routes';
import { manager } from '../test/fixtures';

describe('AuthController', () => {
  const auth = {
    register: jest.fn(),
    login: jest.fn(),
    me: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    accountSummary: jest.fn(),
    deleteAccount: jest.fn(),
  };
  const controller = new AuthController(auth as unknown as AuthService);

  beforeEach(() => jest.clearAllMocks());

  it('est monté sur /auth', () => {
    expect(prefix(AuthController)).toBe('auth');
  });

  it.each([
    ['register', 'POST', 'register'],
    ['login', 'POST', 'login'],
    ['me', 'GET', 'me'],
    ['updateProfile', 'PUT', 'profile'],
    ['changePassword', 'PUT', 'password'],
    ['accountSummary', 'GET', 'account'],
    ['deleteAccount', 'DELETE', 'account'],
  ])('%s → %s %s', (name, method, path) => {
    expect(route(AuthController, name)).toMatchObject({ method, path });
  });

  it.each(['register', 'login'])('%s est accessible sans jeton', (name) => {
    expect(route(AuthController, name).public).toBe(true);
  });

  it.each(['me', 'updateProfile', 'changePassword', 'accountSummary', 'deleteAccount'])(
    '%s exige un jeton',
    (name) => {
      expect(route(AuthController, name).public).toBe(false);
    },
  );

  // Supprimer « le compte », c'est supprimer l'entreprise : un employé est
  // supprimé par son gérant, via DELETE /users/:id.
  it.each(['accountSummary', 'deleteAccount'])('%s est réservée au gérant', (name) => {
    expect(route(AuthController, name).managerOnly).toBe(true);
  });

  it.each(['me', 'updateProfile', 'changePassword'])('%s reste ouverte à l’employé', (name) => {
    expect(route(AuthController, name).managerOnly).toBe(false);
  });

  describe('délégation', () => {
    const identite = { email: 'a@b.fr', password: 'motdepasse' };

    it('register passe le corps', () => {
      void controller.register({ ...identite, companyName: 'F', firstName: 'A', lastName: 'B' });
      expect(auth.register).toHaveBeenCalled();
    });

    it('login passe le corps', () => {
      void controller.login(identite);
      expect(auth.login).toHaveBeenCalledWith(identite);
    });

    it('me passe l’utilisateur courant', () => {
      void controller.me(manager);
      expect(auth.me).toHaveBeenCalledWith(manager);
    });

    it('updateProfile passe utilisateur et corps', () => {
      const dto = { firstName: 'A', lastName: 'B', email: 'a@b.fr' };
      void controller.updateProfile(manager, dto);
      expect(auth.updateProfile).toHaveBeenCalledWith(manager, dto);
    });

    it('changePassword passe utilisateur et corps', () => {
      const dto = { currentPassword: 'x', newPassword: 'motdepasse' };
      void controller.changePassword(manager, dto);
      expect(auth.changePassword).toHaveBeenCalledWith(manager, dto);
    });

    it('accountSummary passe l’utilisateur courant', () => {
      void controller.accountSummary(manager);
      expect(auth.accountSummary).toHaveBeenCalledWith(manager);
    });

    it('deleteAccount passe utilisateur et mot de passe', () => {
      void controller.deleteAccount(manager, { password: 'secret' });
      expect(auth.deleteAccount).toHaveBeenCalledWith(manager, { password: 'secret' });
    });
  });
});
