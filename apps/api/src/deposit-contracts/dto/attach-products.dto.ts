import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class AttachProductsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  productIds!: string[];

  /**
   * Renuméroter les articles rattachés, pour que leur référence dise le dépôt.
   *
   * Laissé à `false` par défaut : la référence est écrite sur l'étiquette
   * collée au vêtement, la changer oblige à retourner en boutique.
   */
  @IsOptional()
  @IsBoolean()
  renumber?: boolean;
}
