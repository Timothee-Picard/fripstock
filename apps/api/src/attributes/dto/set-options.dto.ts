import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, ValidateNested } from 'class-validator';
import { OptionDto } from './create-attribute.dto';

/**
 * Liste complète et ordonnée des options.
 *
 * Un seul endpoint couvre ajout, renommage, réordonnancement et suppression :
 * l'ordre du tableau devient l'ordre affiché, les entrées sans `id` sont
 * créées, celles absentes du tableau sont supprimées. C'est atomique, et ça
 * correspond à ce que fait l'écran : éditer une liste, puis enregistrer.
 */
export class SetOptionsDto {
  @IsArray()
  @ArrayUnique((o: OptionDto) => o.value)
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options!: OptionDto[];
}
