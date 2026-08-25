import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ModifierCategorieDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom?: string;

  /** `null` explicite pour remonter la catégorie à la racine. */
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
