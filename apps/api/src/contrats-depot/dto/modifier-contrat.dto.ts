import { IsEnum, IsInt, IsISO8601, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { StatutContrat } from '../../generated/prisma/enums';

export class ModifierContratDto {
  @IsOptional()
  @IsISO8601()
  dateDebut?: string;

  @IsOptional()
  @IsISO8601()
  dateFin?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commission?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  notifyBeforeDays?: number;

  /** `CLOS` est une décision du gérant ; `EXPIRE` est posé par le job. */
  @IsOptional()
  @IsEnum(StatutContrat)
  statut?: StatutContrat;
}
