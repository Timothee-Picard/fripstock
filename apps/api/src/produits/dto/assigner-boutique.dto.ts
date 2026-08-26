import { IsOptional, IsString } from 'class-validator';

export class AssignerBoutiqueDto {
  /** `null` renvoie le produit au stock central. */
  @IsOptional()
  @IsString()
  boutiqueId?: string | null;
}
