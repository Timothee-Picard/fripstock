import { IsEnum, IsInt, IsISO8601, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ContractStatus } from '../../generated/prisma/enums';

export class UpdateContractDto {
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commission?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  notifyBeforeDays?: number;

  /** `CLOSED` est une décision du gérant ; `EXPIRED` est posé par le job. */
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;
}
