import { ChangePasswordDto } from './change-password.dto';
import { DeleteAccountDto } from './delete-account.dto';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { UpdateProfileDto } from './update-profile.dto';
import { isValid, validateDto } from '../../test/validate';

const inscription = {
  companyName: 'Friperie',
  email: 'gerant@test.fr',
  password: 'motdepasse',
  firstName: 'Camille',
  lastName: 'Durand',
};

describe('DTO auth', () => {
  describe('LoginDto', () => {
    it('normalise l’email avant de le valider', () => {
      const { instance, errors } = validateDto(LoginDto, {
        email: '  Gerant@Test.FR ',
        password: 'x',
      });
      expect(errors).toEqual([]);
      expect(instance.email).toBe('gerant@test.fr');
    });

    it('refuse ce qui n’est pas un email', () => {
      expect(validateDto(LoginDto, { email: 'pas-un-email', password: 'x' }).errors).toContain(
        'email',
      );
    });

    it('refuse un mot de passe vide', () => {
      expect(validateDto(LoginDto, { email: 'a@b.fr', password: '' }).errors).toContain('password');
    });

    it('refuse une valeur non textuelle pour l’email', () => {
      expect(isValid(LoginDto, { email: 42, password: 'x' })).toBe(false);
    });
  });

  describe('RegisterDto', () => {
    it('accepte une inscription complète', () => {
      expect(isValid(RegisterDto, inscription)).toBe(true);
    });

    it.each([
      ['un mot de passe trop court', { ...inscription, password: 'court' }, 'password'],
      ['un nom d’entreprise trop court', { ...inscription, companyName: 'F' }, 'companyName'],
      ['un prénom vide', { ...inscription, firstName: '' }, 'firstName'],
      ['un nom trop long', { ...inscription, lastName: 'x'.repeat(81) }, 'lastName'],
    ])('refuse %s', (_titre, raw, champ) => {
      expect(validateDto(RegisterDto, raw).errors).toContain(champ);
    });

    it('explique en français pourquoi le mot de passe est refusé', () => {
      const erreurs = validateDto(RegisterDto, { ...inscription, password: 'court' });
      expect(erreurs.errors).toContain('password');
    });
  });

  describe('UpdateProfileDto', () => {
    it('rend le mot de passe actuel facultatif', () => {
      expect(
        isValid(UpdateProfileDto, {
          firstName: 'Camille',
          lastName: 'Durand',
          email: 'gerant@test.fr',
        }),
      ).toBe(true);
    });

    it('normalise aussi le nouvel email', () => {
      const { instance } = validateDto(UpdateProfileDto, {
        firstName: 'Camille',
        lastName: 'Durand',
        email: ' NEUF@Test.FR ',
        currentPassword: 'secret',
      });
      expect(instance.email).toBe('neuf@test.fr');
    });
  });

  describe('DeleteAccountDto', () => {
    it('exige le mot de passe', () => {
      expect(validateDto(DeleteAccountDto, {}).errors).toContain('password');
      expect(validateDto(DeleteAccountDto, { password: '' }).errors).toContain('password');
    });

    it('accepte un mot de passe quelconque : il est comparé, pas créé', () => {
      // Aucun minimum de longueur ici : un compte peut avoir été créé avant
      // une règle plus stricte, et son propriétaire doit pouvoir le supprimer.
      expect(isValid(DeleteAccountDto, { password: 'x' })).toBe(true);
    });
  });

  describe('ChangePasswordDto', () => {
    it('exige les deux mots de passe', () => {
      const { errors } = validateDto(ChangePasswordDto, {});
      expect(errors).toEqual(expect.arrayContaining(['currentPassword', 'newPassword']));
    });

    it('impose huit caractères au nouveau', () => {
      expect(
        validateDto(ChangePasswordDto, { currentPassword: 'x', newPassword: 'court' }).errors,
      ).toContain('newPassword');
      expect(isValid(ChangePasswordDto, { currentPassword: 'x', newPassword: 'assezlong' })).toBe(
        true,
      );
    });
  });
});
