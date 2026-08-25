import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  /** Sonde publique : elle doit répondre sans jeton, guard global ou pas. */
  @Public()
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }
}
