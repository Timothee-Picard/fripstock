import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreerStatutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nom!: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'La couleur doit être au format #rrggbb.' })
  couleur?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  ordre?: number;

  /**
   * Les trois flags comportementaux. Ils se fixent ici et ne sont plus
   * modifiables : des produits s'appuieront dessus, et les basculer sous eux
   * réécrirait leur histoire métier. Voir CLAUDE.md, section "Statuts".
   */
  @IsOptional()
  @IsBoolean()
  estVente?: boolean;

  @IsOptional()
  @IsBoolean()
  bloqueVente?: boolean;

  @IsOptional()
  @IsBoolean()
  sortStock?: boolean;
}
