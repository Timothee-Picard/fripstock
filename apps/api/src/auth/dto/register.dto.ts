import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nomEntreprise!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit faire au moins 8 caractères.' })
  @MaxLength(200)
  motDePasse!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  prenom!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nom!: string;
}
