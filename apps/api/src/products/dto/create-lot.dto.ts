import { OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateProductDto } from './create-product.dto';

/**
 * Une ligne du lot : un article, ou plusieurs exemplaires identiques.
 *
 * `purchasePrice` est retiré parce que c'est le lot qui porte le prix payé,
 * réparti ensuite entre ses articles. `saleType` et `depositContractId` le sont
 * aussi : un lot s'achète, il est donc forcément en achat-revente. `shopId` et
 * `quantity` sortent également — la boutique se choisit une fois pour tout le
 * lot, et chaque exemplaire devient un produit distinct de quantité 1.
 */
export class LotLineDto extends OmitType(CreateProductDto, [
  'saleType',
  'depositContractId',
  'purchasePrice',
  'shopId',
  'quantity',
] as const) {
  /**
   * Nombre d'exemplaires identiques à créer depuis cette ligne.
   *
   * Chacun devient un produit à part : le statut porte sur la ligne entière,
   * donc vendre un t-shirt sur quatre est impossible avec une quantité (voir
   * CLAUDE.md). Les références sont alors suffixées `-1`, `-2`…
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  count?: number;
}

export class CreateLotDto {
  /** Prix payé pour le lot entier, réparti au prorata des prix de vente. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalPurchasePrice!: number;

  /** Boutique de destination, commune à tout le lot. */
  @IsOptional()
  @IsString()
  shopId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LotLineDto)
  lines!: LotLineDto[];
}
