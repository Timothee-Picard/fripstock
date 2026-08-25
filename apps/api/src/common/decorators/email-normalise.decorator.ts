import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { applyDecorators } from '@nestjs/common';
import { normaliserEmail } from '../email';

/**
 * Valide un email **après** l'avoir normalisé.
 *
 * L'ordre compte : @IsEmail seul rejetterait « Alice@Test.fr » entourée
 * d'espaces, alors que l'intention de l'utilisateur est parfaitement claire.
 * @Transform s'exécute avant la validation quand le ValidationPipe global a
 * `transform: true`, ce qui est le cas (voir main.ts).
 */
export const EmailNormalise = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normaliserEmail(value) : value,
    ),
    IsEmail(),
  );
