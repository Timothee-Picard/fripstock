import { Module } from '@nestjs/common';
import { AttributsController } from './attributs.controller';
import { AttributsService } from './attributs.service';

@Module({
  controllers: [AttributsController],
  providers: [AttributsService],
})
export class AttributsModule {}
