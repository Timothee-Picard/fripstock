import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  /** Absent ou null : catégorie racine. */
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
