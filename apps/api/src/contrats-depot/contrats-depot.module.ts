import { Module } from '@nestjs/common';
import { ContratsDepotController } from './contrats-depot.controller';
import { ContratsDepotService } from './contrats-depot.service';
import { EcheancesJob } from './echeances.job';

@Module({
  controllers: [ContratsDepotController],
  providers: [ContratsDepotService, EcheancesJob],
  exports: [ContratsDepotService, EcheancesJob],
})
export class ContratsDepotModule {}
