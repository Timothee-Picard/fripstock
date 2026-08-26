import { Module } from '@nestjs/common';
import { StatutsController } from './statuts.controller';
import { StatutsService } from './statuts.service';

@Module({
  controllers: [StatutsController],
  providers: [StatutsService],
  exports: [StatutsService],
})
export class StatutsModule {}
