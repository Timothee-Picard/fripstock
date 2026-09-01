import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { SaleType } from '../../generated/prisma/enums';

/**
 * Colonnes sur lesquelles on peut trier.
 *
 * Liste fermée et non un nom de champ libre : `orderBy` part tel quel à Prisma,
 * et une chaîne venue du client y choisirait une colonne arbitraire.
 */
export const PRODUCT_SORTS = [
  'createdAt',
  'reference',
  'name',
  'salePrice',
  'soldPrice',
  'soldAt',
  'status',
  'category',
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

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

  /** Client déposant : ses articles, quel que soit le contrat. */
  @IsOptional()
  @IsString()
  depositorId?: string;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsEnum(SaleType)
  saleType?: SaleType;

  /**
   * `true` : seulement les articles annoncés sur le site. `false` : seulement
   * ceux qui ne le sont pas. Chaîne et non booléen, comme `unassigned` : une
   * query string ne transporte que du texte.
   */
  @IsOptional()
  @IsIn(['true', 'false'])
  isOnline?: string;

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
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direction?: 'asc' | 'desc';

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
