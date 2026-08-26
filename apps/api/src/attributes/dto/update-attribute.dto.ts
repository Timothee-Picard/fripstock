import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Le type n'est pas modifiable : des valeurs produit déjà saisies s'appuient
 * dessus (texte, nombre, options liées). Changer un SELECT en NUMBER
 * laisserait des valeurs orphelines et intraduisibles.
 */
export class UpdateAttributeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
