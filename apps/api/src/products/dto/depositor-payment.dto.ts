import { IsBoolean } from 'class-validator';

export class PaymentDepositorDto {
  /** `true` : la part du déposant lui a été remise, en espèces. */
  @IsBoolean()
  paid!: boolean;
}
