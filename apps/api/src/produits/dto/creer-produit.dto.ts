import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TypeVente } from '../../generated/prisma/enums';
import { ValeurAttributDto } from './valeur-attribut.dto';

export class CreerProduitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nom!: string;

  @IsString()
  categorieId!: string;

  @IsEnum(TypeVente)
  typeVente!: TypeVente;

  /** Facultatif : un produit peut rester au stock central. */
  @IsOptional()
  @IsString()
  boutiqueId?: string | null;

  /** Facultatif : le statut par défaut de l'entreprise s'applique sinon. */
  @IsOptional()
  @IsString()
  statutId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentaire?: string;

  /** Clé renvoyée par POST /uploads/photo. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  photoUrl?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixAchat?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  prixVente?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantite?: number;

  /** Obligatoire en dépôt-vente, refusé en achat-revente. */
  @IsOptional()
  @IsString()
  contratDepotId?: string;

  @IsOptional()
  @IsISO8601()
  dateVente?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValeurAttributDto)
  attributs?: ValeurAttributDto[];
}
