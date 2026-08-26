import { IsISO8601, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ChangerStatutDto {
  @IsString()
  statutId!: string;

  /** Exigé si le statut cible est un statut de vente, refusé sinon. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixVendu?: number;

  @IsOptional()
  @IsISO8601()
  dateVente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
