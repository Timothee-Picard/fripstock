import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { MAX_MODULES, MODULE_KEY } from '../dashboard-layout';

export class DashboardModuleDto {
  @IsString()
  @Matches(MODULE_KEY, { message: 'Identifiant de module invalide.' })
  key!: string;

  @IsBoolean()
  visible!: boolean;
}

/**
 * Rangement complet, jamais un déplacement isolé : l'écran connaît l'ordre
 * entier au moment où il l'enregistre, et deux onglets ouverts sur le même
 * compte doivent aboutir à l'un des deux rangements, pas à leur mélange.
 */
export class DashboardLayoutDto {
  @IsArray()
  @ArrayMaxSize(MAX_MODULES)
  @ArrayUnique((m: DashboardModuleDto) => m.key)
  @ValidateNested({ each: true })
  @Type(() => DashboardModuleDto)
  modules!: DashboardModuleDto[];
}
