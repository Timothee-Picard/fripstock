import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Le nouveau mot de passe doit faire au moins 8 caractères.' })
  @MaxLength(200)
  newPassword!: string;
}
