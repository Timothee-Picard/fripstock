import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

/**
 * Tous les champs deviennent facultatifs. Le statut ne se change pas ici :
 * il a sa propre route, qui trace l'historique et applique les règles de vente.
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
