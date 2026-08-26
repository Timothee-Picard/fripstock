import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateShopDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
}
