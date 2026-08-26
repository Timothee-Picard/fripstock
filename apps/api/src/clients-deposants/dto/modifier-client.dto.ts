import { PartialType } from '@nestjs/mapped-types';
import { CreerClientDto } from './creer-client.dto';

export class ModifierClientDto extends PartialType(CreerClientDto) {}
