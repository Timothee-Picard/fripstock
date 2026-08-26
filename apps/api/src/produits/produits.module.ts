import { Module } from '@nestjs/common';
import { StatutsModule } from '../statuts/statuts.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ProduitsController } from './produits.controller';
import { ProduitsService } from './produits.service';

@Module({
  imports: [StatutsModule, UploadsModule],
  controllers: [ProduitsController],
  providers: [ProduitsService],
})
export class ProduitsModule {}
