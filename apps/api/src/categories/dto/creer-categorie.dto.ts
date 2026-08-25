import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreerCategorieDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom!: string;

  /** Absent ou null : catégorie racine. */
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
