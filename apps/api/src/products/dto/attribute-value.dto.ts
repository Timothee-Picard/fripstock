import { IsDefined, IsString } from 'class-validator';

/**
 * Valeur d'un attribut dynamique sur un produit.
 *
 * `value` est volontairement non typée ici : sa forme dépend du type de
 * l'attribut, connu seulement en base. La validation réelle (nombre pour
 * NUMBER, option existante pour SELECT, tableau pour MULTISELECT…) est faite
 * dans le service, où l'attribut est chargé.
 */
export class ValueAttributeDto {
  @IsString()
  attributeDefinitionId!: string;

  @IsDefined()
  value!: unknown;
}
