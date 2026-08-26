import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Utilisateur } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { UtilisateurCourant } from '../common/types/utilisateur-courant';
import { TAILLE_MAX_OCTETS, UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /**
   * Déposer une photo revient à préparer un produit : même permission.
   * Aucune boutique n'est visée, la règle du stock central s'applique.
   */
  @Post('photo')
  @RequirePermission('produits.creer')
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_OCTETS } }))
  async deposer(
    @Utilisateur() courant: UtilisateurCourant,
    @UploadedFile() fichier: Express.Multer.File,
  ) {
    return { cle: await this.uploads.enregistrerPhoto(courant.entrepriseId, fichier) };
  }

  /**
   * Lecture d'une photo. Le bucket n'est pas public : le front passe par cette
   * route, authentifié, plutôt que par une URL MinIO devinable.
   *
   * `*cle` capture les slashs — la clé contient celui du préfixe d'entreprise.
   */
  @Get('photo/*cle')
  async lire(
    @Utilisateur() courant: UtilisateurCourant,
    @Param('cle') cle: string | string[],
    @Res({ passthrough: true }) reponse: Response,
  ) {
    const chemin = Array.isArray(cle) ? cle.join('/') : cle;
    const { flux, type } = await this.uploads.lire(courant.entrepriseId, chemin);
    reponse.set({
      'Content-Type': type,
      // Immuable : la clé contient un UUID, le contenu ne change jamais.
      'Cache-Control': 'private, max-age=31536000, immutable',
    });
    // StreamableFile et non le flux brut : sans lui, Nest sérialise l'objet en
    // JSON au lieu de le diffuser.
    return new StreamableFile(flux);
  }
}
