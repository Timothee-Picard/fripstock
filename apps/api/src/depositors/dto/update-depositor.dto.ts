import { PartialType } from '@nestjs/mapped-types';
import { CreateDepositorDto } from './create-depositor.dto';

export class UpdateDepositorDto extends PartialType(CreateDepositorDto) {}
