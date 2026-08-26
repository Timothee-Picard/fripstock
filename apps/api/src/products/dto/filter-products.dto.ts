import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { SaleType } from '../../generated/prisma/enums';

export class FilterProductsDto {
  @IsOptional()
  @IsString()
  shopId?: string;

  /** `true` pour ne voir que le stock central (produits non assignés). */
  @IsOptional()
  @IsString()
  unassigned?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsEnum(SaleType)
  saleType?: SaleType;

  /** Recherche sur le nom, la référence et la description. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsISO8601()
  createdAfter?: string;

  @IsOptional()
  @IsISO8601()
  createdBefore?: string;

  @IsOptional()
  @IsISO8601()
  soldAfter?: string;

  @IsOptional()
  @IsISO8601()
  soldBefore?: string;

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
  perPage?: number;
}
