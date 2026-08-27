import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { DepositContractsController } from './deposit-contracts.controller';
import { DepositContractsService } from './deposit-contracts.service';
import { DeadlinesJob } from './deadlines.job';

@Module({
  imports: [ProductsModule],
  controllers: [DepositContractsController],
  providers: [DepositContractsService, DeadlinesJob],
  exports: [DepositContractsService, DeadlinesJob],
})
export class DepositContractsModule {}
