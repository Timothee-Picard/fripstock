import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Client } from 'minio';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

/** Formats acceptés, contrôlés sur le contenu réel et pas sur l'extension. */
const TYPES_AUTORISES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export const TAILLE_MAX_OCTETS = 5 * 1024 * 1024;

/**
 * Signatures binaires des formats acceptés. Le `mimetype` transmis par le
 * navigateur est déclaratif : n'importe qui peut envoyer un exécutable en
 * annonçant image/png. On vérifie donc les premiers octets du fichier.
 */
const SIGNATURES: { type: string; octets: number[]; decalage: number }[] = [
  { type: 'image/jpeg', octets: [0xff, 0xd8, 0xff], decalage: 0 },
  { type: 'image/png', octets: [0x89, 0x50, 0x4e, 0x47], decalage: 0 },
  { type: 'image/webp', octets: [0x57, 0x45, 0x42, 0x50], decalage: 8 },
  { type: 'image/avif', octets: [0x66, 0x74, 0x79, 0x70], decalage: 4 },
];

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private readonly client: Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET ?? 'produits';
    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'minio',
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY ?? '',
      secretKey: process.env.MINIO_SECRET_KEY ?? '',
    });
  }

  /** Le bucket n'est pas créé par docker-compose : on s'en charge au démarrage. */
  async onModuleInit(): Promise<void> {
    try {
      if (!(await this.client.bucketExists(this.bucket))) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket « ${this.bucket} » créé.`);
      }
    } catch (erreur) {
      // Ne pas empêcher l'API de démarrer : seul l'upload sera indisponible.
      this.logger.error(`MinIO injoignable : ${(erreur as Error).message}`);
    }
  }

  /**
   * Range une photo et renvoie sa clé. Le bucket reste privé : la lecture passe
   * par `lire()`, derrière l'authentification, jamais par une URL publique.
   *
   * La clé est préfixée par l'entreprise — cloisonnement du stockage, et un
   * inventaire du bucket reste lisible.
   */
  async enregistrerPhoto(entrepriseId: string, fichier: Express.Multer.File): Promise<string> {
    if (!fichier?.buffer?.length) {
      throw new BadRequestException('Fichier vide.');
    }
    if (fichier.size > TAILLE_MAX_OCTETS) {
      throw new BadRequestException(
        `Image trop lourde (${Math.round(fichier.size / 1024 / 1024)} Mo). Maximum ${TAILLE_MAX_OCTETS / 1024 / 1024} Mo.`,
      );
    }

    const type = this.typeReel(fichier.buffer);
    if (!type) {
      throw new BadRequestException(
        `Format non reconnu. Formats acceptés : ${Object.values(TYPES_AUTORISES).join(', ')}.`,
      );
    }

    const cle = `${entrepriseId}/${randomUUID()}.${TYPES_AUTORISES[type]}`;
    await this.client.putObject(this.bucket, cle, fichier.buffer, fichier.size, {
      'Content-Type': type,
    });
    return cle;
  }

  /** Flux de lecture d'une photo, scopé à l'entreprise via le préfixe de clé. */
  async lire(entrepriseId: string, cle: string): Promise<{ flux: Readable; type: string }> {
    if (!cle.startsWith(`${entrepriseId}/`)) {
      // Le préfixe fait office de contrôle d'accès : une clé d'une autre
      // entreprise est traitée comme inexistante.
      throw new NotFoundException('Photo introuvable.');
    }
    try {
      const stat = await this.client.statObject(this.bucket, cle);
      const flux = await this.client.getObject(this.bucket, cle);
      const declare: unknown = stat.metaData?.['content-type'];
      return {
        flux,
        type: typeof declare === 'string' ? declare : 'application/octet-stream',
      };
    } catch {
      throw new NotFoundException('Photo introuvable.');
    }
  }

  async supprimer(cle: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, cle);
    } catch (erreur) {
      // Une photo orpheline dans le bucket est moins grave qu'une suppression
      // de produit qui échoue : on trace et on continue.
      this.logger.warn(`Suppression de « ${cle} » impossible : ${(erreur as Error).message}`);
    }
  }

  private typeReel(buffer: Buffer): string | null {
    for (const { type, octets, decalage } of SIGNATURES) {
      if (octets.every((o, i) => buffer[decalage + i] === o)) return type;
    }
    return null;
  }
}
