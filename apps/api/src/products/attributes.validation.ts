import { BadRequestException } from '@nestjs/common';
import type { AttributeType } from '../generated/prisma/enums';

export interface ApplicableAttribute {
  id: string;
  name: string;
  type: AttributeType;
  options: { id: string; value: string }[];
}

/** Ce qu'il faut écrire en base pour une valeur d'attribut validée. */
export interface NormalisedValue {
  attributeDefinitionId: string;
  textValue?: string | null;
  numberValue?: number | null;
  booleanValue?: boolean | null;
  /** Identifiants d'options, pour SELECT (une) et MULTISELECT (plusieurs). */
  optionIds: string[];
}

/**
 * Valide une valeur d'attribut contre le type réellement déclaré en base.
 *
 * Le DTO ne peut pas s'en charger : la forme attendue dépend du type de
 * l'attribut, qu'on ne connaît qu'après l'avoir chargé.
 */
export function normalizeValue(attribute: ApplicableAttribute, value: unknown): NormalisedValue {
  const base: NormalisedValue = { attributeDefinitionId: attribute.id, optionIds: [] };
  const deny = (attendu: string): never => {
    throw new BadRequestException(`« ${attribute.name} » attend ${attendu}.`);
  };

  switch (attribute.type) {
    case 'TEXT': {
      if (typeof value !== 'string') deny('du texte');
      const text = (value as string).trim();
      return { ...base, textValue: text.length > 0 ? text : null };
    }

    case 'NUMBER': {
      const count = typeof value === 'string' ? Number(value) : value;
      if (typeof count !== 'number' || Number.isNaN(count)) deny('un nombre');
      return { ...base, numberValue: count as number };
    }

    case 'BOOLEAN': {
      if (typeof value === 'boolean') return { ...base, booleanValue: value };
      if (value === 'true' || value === 'false') {
        return { ...base, booleanValue: value === 'true' };
      }
      return deny('oui ou non');
    }

    case 'SELECT': {
      if (typeof value !== 'string') deny('une option');
      const option = attribute.options.find((o) => o.id === value || o.value === value);
      if (!option) {
        deny(`une de ses options (${attribute.options.map((o) => o.value).join(', ')})`);
      }
      return { ...base, optionIds: [option!.id] };
    }

    case 'MULTISELECT': {
      const list = Array.isArray(value) ? value : [value];
      const ids: string[] = [];
      for (const raw of list) {
        if (typeof raw !== 'string') deny('une liste d’options');
        const option = attribute.options.find((o) => o.id === raw || o.value === raw);
        if (!option) {
          deny(`des options connues (${attribute.options.map((o) => o.value).join(', ')})`);
        }
        if (!ids.includes(option!.id)) ids.push(option!.id);
      }
      return { ...base, optionIds: ids };
    }
  }
}
