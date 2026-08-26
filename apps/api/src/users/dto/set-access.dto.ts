import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { PERMISSIONS, type Permission } from '../../common/permissions';

export class AccessShopDto {
  @IsString()
  shopId!: string;

  /**
   * Permissions activées pour cette boutique. `IsIn` sur la liste partagée :
   * une clé mal orthographiée est rejetée au lieu d'être stockée en silence
   * dans un JSON que personne ne relira.
   */
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSIONS, { each: true })
  permissions!: Permission[];
}

export class SetAccessDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccessShopDto)
  accesses!: AccessShopDto[];
}
