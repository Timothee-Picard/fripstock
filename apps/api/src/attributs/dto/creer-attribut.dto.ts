import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TypeAttribut } from '../../generated/prisma/enums';

export class OptionDto {
  /** Absent pour une option nouvelle, renseigné pour une option existante. */
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  valeur!: string;
}

export class CreerAttributDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom!: string;

  @IsEnum(TypeAttribut)
  type!: TypeAttribut;

  /** Ignoré pour les types autres que SELECT et MULTISELECT. */
  @IsOptional()
  @IsArray()
  @ArrayUnique((o: OptionDto) => o.valeur)
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];
}
