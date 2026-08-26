import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { TypeVente } from '../../generated/prisma/enums';

export class FiltrerProduitsDto {
  @IsOptional()
  @IsString()
  boutiqueId?: string;

  /** `true` pour ne voir que le stock central (produits non assignés). */
  @IsOptional()
  @IsString()
  nonAssigne?: string;

  @IsOptional()
  @IsString()
  categorieId?: string;

  @IsOptional()
  @IsString()
  statutId?: string;

  @IsOptional()
  @IsEnum(TypeVente)
  typeVente?: TypeVente;

  /** Recherche sur le nom, la référence et la description. */
  @IsOptional()
  @IsString()
  recherche?: string;

  @IsOptional()
  @IsISO8601()
  creeApres?: string;

  @IsOptional()
  @IsISO8601()
  creeAvant?: string;

  @IsOptional()
  @IsISO8601()
  venduApres?: string;

  @IsOptional()
  @IsISO8601()
  venduAvant?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  parPage?: number;
}
