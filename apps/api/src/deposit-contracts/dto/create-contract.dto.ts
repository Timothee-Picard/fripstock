import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ContractProductDto } from './contract-product.dto';

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

  /**
   * Articles déposés, saisis dans la foulée du contrat.
   *
   * Facultatif : un contrat peut être ouvert vide, quitte à lui rattacher des
   * produits existants ensuite. Quand la liste est fournie, contrat et articles
   * sont écrits dans la même transaction — une ligne refusée n'enregistre rien.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ContractProductDto)
  products?: ContractProductDto[];
}
