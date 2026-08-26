import { SetMetadata } from '@nestjs/common';

export const PUBLIC_KEY = 'isPublic';

/** Rend une route accessible sans JWT (le guard global est actif partout ailleurs). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
