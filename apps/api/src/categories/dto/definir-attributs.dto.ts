import { ArrayUnique, IsArray, IsString } from 'class-validator';

/** Liste complète des attributs proposés pour cette catégorie. */
export class DefinirAttributsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  attributDefinitionIds!: string[];
}
