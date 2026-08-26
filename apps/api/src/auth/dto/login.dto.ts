import { EmailNormalise } from '../../common/decorators/email-normalise.decorator';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @EmailNormalise()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
