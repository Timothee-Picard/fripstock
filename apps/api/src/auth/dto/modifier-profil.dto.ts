import { EmailNormalise } from '../../common/decorators/email-normalise.decorator';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ModifierProfilDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  prenom!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nom!: string;

  @EmailNormalise()
  email!: string;

  /**
   * Exigé uniquement si l'email change : sur une session détournée, pouvoir
   * changer l'adresse de connexion suffirait à s'approprier le compte.
   * Renommer quelqu'un n'a pas cette conséquence.
   */
  @IsOptional()
  @IsString()
  motDePasseActuel?: string;
}
