import { IsBoolean } from 'class-validator';

export class DepositorPaymentDto {
  /** `true` : la part du déposant lui a été remise, en espèces. */
  @IsBoolean()
  paid!: boolean;
}
