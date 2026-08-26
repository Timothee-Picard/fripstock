import { ArrayNotEmpty, ArrayUnique, IsArray, IsString } from 'class-validator';

export class AttachProductsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  productIds!: string[];
}
