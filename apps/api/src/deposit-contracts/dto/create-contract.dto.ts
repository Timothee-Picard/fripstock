import { IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateContractDto {
  @IsString()
  depositorId!: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  /**
   * Part que garde la boutique. Facultative : à défaut, on reprend le
   * `defaultCommission` du déposant — mais elle reste modifiable pour ce contrat.
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
