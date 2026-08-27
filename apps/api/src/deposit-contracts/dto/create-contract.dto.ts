import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
   * **Au moins un** : un contrat de dépôt sans article ne veut rien dire — on
   * ne fait pas signer un déposant pour rien, et le relevé qui en découlerait
   * serait vide. Contrat et articles sont écrits dans la même transaction, une
   * ligne refusée n'enregistre rien.
   */
  @IsArray({ message: 'La liste des articles déposés est absente ou mal formée.' })
  @ArrayMinSize(1, { message: 'Un contrat de dépôt doit porter au moins un article.' })
  @ArrayMaxSize(200, { message: 'Un contrat ne peut pas porter plus de 200 articles.' })
  @ValidateNested({ each: true })
  @Type(() => ContractProductDto)
  products!: ContractProductDto[];
}
