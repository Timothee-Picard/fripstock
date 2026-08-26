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

export class CreateDepositorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @EmailNormalise()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

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
  defaultCommission?: number;
}
