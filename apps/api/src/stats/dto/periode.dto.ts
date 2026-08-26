import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class PeriodeDto {
  /** Début de période, inclus. À défaut : les 30 derniers jours. */
  @IsOptional()
  @IsISO8601()
  du?: string;

  /** Fin de période, incluse. */
  @IsOptional()
  @IsISO8601()
  au?: string;

  @IsOptional()
  @IsString()
  boutiqueId?: string;
}
