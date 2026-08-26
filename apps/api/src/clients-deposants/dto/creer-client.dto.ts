import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EmailNormalise } from '../../common/decorators/email-normalise.decorator';

export class CreerClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  prenom?: string;

  @IsOptional()
  @EmailNormalise()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telephone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  adresse?: string;

  @IsOptional()
  @Matches(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/, {
    message: "L'IBAN doit commencer par deux lettres puis deux chiffres, sans espaces.",
  })
  iban?: string;

  /**
   * Part que garde la boutique, en pourcentage. Voir CLAUDE.md : `commission = 40`
   * signifie 40 % pour la boutique et 60 % pour le déposant.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionDefaut?: number;
}
