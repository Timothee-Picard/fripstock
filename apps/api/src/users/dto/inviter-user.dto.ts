import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class InviterUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  prenom!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nom!: string;

  /** Facultatif : si absent, un mot de passe temporaire est généré et renvoyé. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  motDePasse?: string;
}
