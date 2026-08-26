import { ArrayNotEmpty, ArrayUnique, IsArray, IsString } from 'class-validator';

export class RattacherProduitsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  produitIds!: string[];
}
