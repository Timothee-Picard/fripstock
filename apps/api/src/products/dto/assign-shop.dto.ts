import { IsOptional, IsString } from 'class-validator';

export class AssignShopDto {
  /** `null` renvoie le produit au stock central. */
  @IsOptional()
  @IsString()
  shopId?: string | null;
}
