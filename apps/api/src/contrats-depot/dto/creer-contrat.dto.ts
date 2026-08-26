import { IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreerContratDto {
  @IsString()
  clientId!: string;

  @IsISO8601()
  dateDebut!: string;

  @IsISO8601()
  dateFin!: string;

  /**
   * Part que garde la boutique. Facultative : à défaut, on reprend le
   * `commissionDefaut` du déposant — mais elle reste modifiable pour ce contrat.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commission?: number;

  /** Nombre de jours avant l'échéance où l'alerte est déclenchée. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  notifyBeforeDays?: number;
}
