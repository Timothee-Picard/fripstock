import { IsBoolean } from 'class-validator';

export class PaiementDeposantDto {
  /** `true` : la part du déposant lui a été remise, en espèces. */
  @IsBoolean()
  paye!: boolean;
}
