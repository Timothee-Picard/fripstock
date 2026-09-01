import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/**
 * Retraits confirmés en une fois.
 *
 * Les identifiants sont explicites plutôt qu'un « tout ce qui est en attente » :
 * on ne confirme que ce qu'on avait sous les yeux. Un lot arrivé entre
 * l'affichage et le clic ne doit pas être soldé sans avoir été vu.
 */
export class RemovalsDoneDto {
  @IsArray()
  @ArrayNotEmpty()
  // Le tableau de bord n'en liste que 50 : au-delà, la requête ne vient pas de
  // l'écran.
  @ArrayMaxSize(50)
  @IsString({ each: true })
  productIds!: string[];
}
