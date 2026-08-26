import { ArrayUnique, IsArray, IsString } from 'class-validator';

/** Liste complète des catégories auxquelles l'attribut s'applique. */
export class SetCategoriesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  categoryIds!: string[];
}
