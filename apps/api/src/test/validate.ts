import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

/**
 * Valide un objet brut comme le ferait le `ValidationPipe` global, transform
 * comprise — c'est elle qui normalise les emails et convertit les nombres
 * arrivés en chaîne depuis une query string.
 */
export function validateDto<T extends object>(
  cls: new () => T,
  raw: Record<string, unknown>,
): { instance: T; errors: string[] } {
  const instance = plainToInstance(cls, raw, { enableImplicitConversion: true });
  const errors = validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).flatMap((e) => collect(e));
  return { instance, errors };
}

function collect(error: { property: string; children?: unknown[] }): string[] {
  const children = (error.children ?? []) as { property: string; children?: unknown[] }[];
  if (children.length === 0) return [error.property];
  return children.flatMap((c) => collect(c).map((p) => `${error.property}.${p}`));
}

/** Raccourci : la validation passe-t-elle ? */
export function isValid<T extends object>(cls: new () => T, raw: Record<string, unknown>): boolean {
  return validateDto(cls, raw).errors.length === 0;
}
