import { ArrayUnique, IsArray, IsString } from 'class-validator';

/** Liste complète des catégories auxquelles l'attribut s'applique. */
export class DefinirCategoriesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  categorieIds!: string[];
}
