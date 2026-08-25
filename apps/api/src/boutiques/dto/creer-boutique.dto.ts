import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreerBoutiqueDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  adresse?: string;
}
