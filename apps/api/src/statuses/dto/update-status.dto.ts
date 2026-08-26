import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Seuls le libellé, la couleur et l'ordre sont modifiables. Les flags
 * comportementaux sont volontairement absents : voir CreateStatusDto.
 */
export class UpdateStatusDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'La couleur doit être au format #rrggbb.' })
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  position?: number;
}
