import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangerMotDePasseDto {
  @IsString()
  @MinLength(1)
  motDePasseActuel!: string;

  @IsString()
  @MinLength(8, { message: 'Le nouveau mot de passe doit faire au moins 8 caractères.' })
  @MaxLength(200)
  nouveauMotDePasse!: string;
}
