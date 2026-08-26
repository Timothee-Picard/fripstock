import { EmailNormalise } from '../../common/decorators/email-normalise.decorator';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class InviteUserDto {
  @EmailNormalise()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  /** Facultatif : si absent, un mot de passe temporaire est généré et renvoyé. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password?: string;
}
