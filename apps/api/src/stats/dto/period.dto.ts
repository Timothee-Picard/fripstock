import { IsISO8601, IsOptional, IsString } from 'class-validator';

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
}
