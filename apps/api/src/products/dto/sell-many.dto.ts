import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaleLineDto {
  @IsString()
  productId!: string;

  /** Prix réellement encaissé pour cet article, remise déjà répartie. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  soldPrice!: number;
}

/**
 * Vente au comptoir : plusieurs articles passent à vendu d'un coup.
 *
 * Le prix est donné ligne par ligne, déjà réparti : la remise éventuelle est
 * une affaire d'affichage, ce qui compte en base est ce que chaque article a
 * réellement rapporté — c'est lui qui nourrit la marge et le relevé du
 * déposant.
 */
export class SellManyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((l: SaleLineDto) => l.productId)
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines!: SaleLineDto[];

  /**
   * Statut de vente à appliquer. Facultatif tant que l'entreprise n'en a
   * qu'un — ce qui est le cas des statuts de base.
   */
  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsISO8601()
  soldAt?: string;
}
