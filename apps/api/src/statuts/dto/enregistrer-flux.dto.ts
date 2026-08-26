import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';

export class PositionStatutDto {
  @IsString()
  id!: string;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class TransitionDto {
  @IsString()
  sourceId!: string;

  @IsString()
  cibleId!: string;
}

/**
 * Enregistrement du schéma complet en un appel : positions et flèches.
 *
 * L'écran est un canevas qu'on manipule puis qu'on enregistre — un endpoint par
 * flèche obligerait à séquencer des appels et laisserait le schéma à moitié
 * sauvegardé en cas de coupure.
 */
export class EnregistrerFluxDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionStatutDto)
  positions!: PositionStatutDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransitionDto)
  transitions!: TransitionDto[];
}
