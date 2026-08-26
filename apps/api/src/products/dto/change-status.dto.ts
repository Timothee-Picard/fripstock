import { IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ChangeStatusDto {
  @IsString()
  statusId!: string;

  /** Exigé si le statut cible est un statut de vente, refusé sinon. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  soldPrice?: number;

  @IsOptional()
  @IsISO8601()
  soldAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
