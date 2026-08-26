import { Module } from '@nestjs/common';
import { ClientsDeposantsController } from './clients-deposants.controller';
import { ClientsDeposantsService } from './clients-deposants.service';

@Module({
  controllers: [ClientsDeposantsController],
  providers: [ClientsDeposantsService],
  exports: [ClientsDeposantsService],
})
export class ClientsDeposantsModule {}
