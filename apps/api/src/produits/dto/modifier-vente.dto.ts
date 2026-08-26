import { IsISO8601, IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Correction des données de vente d'un produit déjà vendu.
 *
 * Distinct du changement de statut, qui trace l'historique : ici on rectifie
 * une saisie, on ne fait pas franchir une étape au produit.
 */
export class ModifierVenteDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixVendu?: number;

  @IsOptional()
  @IsISO8601()
  dateVente?: string;

  /**
   * Commission figée au moment de la vente, en pourcentage (part de la
   * boutique). Pertinente uniquement en dépôt-vente.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionAppliquee?: number;
}
