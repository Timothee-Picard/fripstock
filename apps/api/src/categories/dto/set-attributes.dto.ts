import { ArrayUnique, IsArray, IsString } from 'class-validator';

/** Liste complète des attributs proposés pour cette catégorie. */
export class SetAttributesDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  attributeDefinitionIds!: string[];
}
