import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

export class PeriodDto {
  /** Début de période, inclus. À défaut : les 30 derniers jours. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Fin de période, incluse. */
  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  shopId?: string;

  /**
   * Canal regardé. `online` place le tableau de bord sur la boutique en ligne,
   * au même rang qu'une boutique physique : ses ventes, son stock annoncé, ses
   * retraits. Exclusif de `shopId` — on regarde un endroit à la fois.
   */
  @IsOptional()
  @IsIn(['online'])
  channel?: 'online';
}
