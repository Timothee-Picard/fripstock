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
import { AttributeType } from '../../generated/prisma/enums';

export class OptionDto {
  /** Absent pour une option nouvelle, renseigné pour une option existante. */
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  value!: string;
}

export class CreateAttributeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEnum(AttributeType)
  type!: AttributeType;

  /** Ignoré pour les types autres que SELECT et MULTISELECT. */
  @IsOptional()
  @IsArray()
  @ArrayUnique((o: OptionDto) => o.value)
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];
}
