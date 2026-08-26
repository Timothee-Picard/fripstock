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
import { AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { CurrentUser } from '../common/types/current-user';
import { TAILLE_MAX_OCTETS, UploadsService } from './uploads.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /**
   * Déposer une photo revient à préparer un produit : même permission.
   * Aucune boutique n'est visée, la règle du stock central s'applique.
   */
  @Post('photo')
  @RequirePermission('products.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TAILLE_MAX_OCTETS } }))
  async upload(@AuthUser() currentUser: CurrentUser, @UploadedFile() file: Express.Multer.File) {
    return { key: await this.uploads.savePhoto(currentUser.companyId, file) };
  }

  /**
   * Lecture d'une photo. Le bucket n'est pas public : le front passe par cette
   * route, authentifié, plutôt que par une URL MinIO devinable.
   *
   * `*key` capture les slashs — la clé contient celui du préfixe d'entreprise.
   */
  @Get('photo/*key')
  async read(
    @AuthUser() currentUser: CurrentUser,
    @Param('key') key: string | string[],
    @Res({ passthrough: true }) reponse: Response,
  ) {
    const path = Array.isArray(key) ? key.join('/') : key;
    const { stream, type } = await this.uploads.read(currentUser.companyId, path);
    reponse.set({
      'Content-Type': type,
      // Immuable : la clé contient un UUID, le contenu ne change jamais.
      'Cache-Control': 'private, max-age=31536000, immutable',
    });
    // StreamableFile et non le stream brut : sans lui, Nest sérialise l'objet en
    // JSON au lieu de le diffuser.
    return new StreamableFile(stream);
  }
}
