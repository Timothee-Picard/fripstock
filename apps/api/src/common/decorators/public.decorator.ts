import { SetMetadata } from '@nestjs/common';

export const CLE_PUBLIC = 'estPublic';

/** Rend une route accessible sans JWT (le guard global est actif partout ailleurs). */
export const Public = () => SetMetadata(CLE_PUBLIC, true);
