import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  /**
   * Le mot de passe, redemandé pour une action irréversible : une session
   * laissée ouverte sur le comptoir ne doit pas suffire à effacer l'entreprise.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
