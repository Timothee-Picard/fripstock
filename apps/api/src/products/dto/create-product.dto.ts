import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SaleType } from '../../generated/prisma/enums';
import { ValueAttributeDto } from './attribute-value.dto';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  categoryId!: string;

  @IsEnum(SaleType)
  saleType!: SaleType;

  /** Facultatif : un produit peut rester au stock central. */
  @IsOptional()
  @IsString()
  shopId?: string | null;

  /** Facultatif : le statut par défaut de l'entreprise s'applique sinon. */
  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNote?: string;

  /** Clé renvoyée par POST /uploads/photo. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  photoUrl?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  /** Obligatoire en dépôt-vente, refusé en achat-revente. */
  @IsOptional()
  @IsString()
  depositContractId?: string;

  @IsOptional()
  @IsISO8601()
  soldAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValueAttributeDto)
  attributes?: ValueAttributeDto[];
}
