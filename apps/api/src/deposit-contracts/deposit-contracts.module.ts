import { Module } from '@nestjs/common';
import { DepositContractsController } from './deposit-contracts.controller';
import { DepositContractsService } from './deposit-contracts.service';
import { DeadlinesJob } from './deadlines.job';

@Module({
  controllers: [DepositContractsController],
  providers: [DepositContractsService, DeadlinesJob],
  exports: [DepositContractsService, DeadlinesJob],
})
export class DepositContractsModule {}
