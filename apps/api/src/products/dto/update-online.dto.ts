import { IsBoolean, IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';

/**
 * Mise en ligne d'un article, et prix affiché sur le site.
 *
 * Distinct de `UpdateProductDto` : une personne qui ne gère que la vente en
 * ligne doit pouvoir publier un vêtement sans pouvoir en corriger le nom ni le
 * prix boutique. Deux routes, deux droits.
 */
export class UpdateOnlineDto {
  /** `true` publie l'annonce, `false` la retire. */
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  /**
   * Prix affiché sur le site. `null` l'efface : le site retombe alors sur le
   * prix boutique, plutôt que d'obliger à saisir deux fois le même montant.
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  onlinePrice?: number | null;
}
