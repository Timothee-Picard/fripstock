import { PartialType } from '@nestjs/mapped-types';
import { CreerProduitDto } from './creer-produit.dto';

/**
 * Tous les champs deviennent facultatifs. Le statut ne se change pas ici :
 * il a sa propre route, qui trace l'historique et applique les règles de vente.
 */
export class ModifierProduitDto extends PartialType(CreerProduitDto) {}
