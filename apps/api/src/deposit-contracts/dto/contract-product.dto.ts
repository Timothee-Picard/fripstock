import { OmitType } from '@nestjs/mapped-types';
import { CreateProductDto } from '../../products/dto/create-product.dto';

/**
 * Article saisi directement dans le formulaire de contrat.
 *
 * Trois champs de `CreateProductDto` sont retirés parce que le contrat les
 * impose : le mode de vente est forcément le dépôt-vente, le contrat est celui
 * qu'on est en train de créer, et un article déposé n'a pas de prix d'achat —
 * il appartient au déposant (voir CLAUDE.md).
 */
export class ContractProductDto extends OmitType(CreateProductDto, [
  'saleType',
  'depositContractId',
  'purchasePrice',
] as const) {}
