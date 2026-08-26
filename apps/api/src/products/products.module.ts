import { Module } from '@nestjs/common';
import { StatusesModule } from '../statuses/statuses.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [StatusesModule, UploadsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
