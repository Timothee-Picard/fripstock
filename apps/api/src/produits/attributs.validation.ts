import { BadRequestException } from '@nestjs/common';
import type { TypeAttribut } from '../generated/prisma/enums';

export interface AttributApplicable {
  id: string;
  nom: string;
  type: TypeAttribut;
  options: { id: string; valeur: string }[];
}

/** Ce qu'il faut écrire en base pour une valeur d'attribut validée. */
export interface ValeurNormalisee {
  attributDefinitionId: string;
  valeurTexte?: string | null;
  valeurNombre?: number | null;
  valeurBooleenne?: boolean | null;
  /** Identifiants d'options, pour SELECT (une) et MULTISELECT (plusieurs). */
  optionIds: string[];
}

/**
 * Valide une valeur d'attribut contre le type réellement déclaré en base.
 *
 * Le DTO ne peut pas s'en charger : la forme attendue dépend du type de
 * l'attribut, qu'on ne connaît qu'après l'avoir chargé.
 */
export function normaliserValeur(attribut: AttributApplicable, valeur: unknown): ValeurNormalisee {
  const base: ValeurNormalisee = { attributDefinitionId: attribut.id, optionIds: [] };
  const refuser = (attendu: string): never => {
    throw new BadRequestException(`« ${attribut.nom} » attend ${attendu}.`);
  };

  switch (attribut.type) {
    case 'TEXT': {
      if (typeof valeur !== 'string') refuser('du texte');
      const texte = (valeur as string).trim();
      return { ...base, valeurTexte: texte.length > 0 ? texte : null };
    }

    case 'NUMBER': {
      const nombre = typeof valeur === 'string' ? Number(valeur) : valeur;
      if (typeof nombre !== 'number' || Number.isNaN(nombre)) refuser('un nombre');
      return { ...base, valeurNombre: nombre as number };
    }

    case 'BOOLEAN': {
      if (typeof valeur === 'boolean') return { ...base, valeurBooleenne: valeur };
      if (valeur === 'true' || valeur === 'false') {
        return { ...base, valeurBooleenne: valeur === 'true' };
      }
      return refuser('oui ou non');
    }

    case 'SELECT': {
      if (typeof valeur !== 'string') refuser('une option');
      const option = attribut.options.find((o) => o.id === valeur || o.valeur === valeur);
      if (!option) {
        refuser(`une de ses options (${attribut.options.map((o) => o.valeur).join(', ')})`);
      }
      return { ...base, optionIds: [option!.id] };
    }

    case 'MULTISELECT': {
      const liste = Array.isArray(valeur) ? valeur : [valeur];
      const ids: string[] = [];
      for (const brut of liste) {
        if (typeof brut !== 'string') refuser('une liste d’options');
        const option = attribut.options.find((o) => o.id === brut || o.valeur === brut);
        if (!option) {
          refuser(`des options connues (${attribut.options.map((o) => o.valeur).join(', ')})`);
        }
        if (!ids.includes(option!.id)) ids.push(option!.id);
      }
      return { ...base, optionIds: ids };
    }
  }
}
