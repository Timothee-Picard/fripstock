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
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Signatures binaires des formats acceptés. Le `mimetype` transmis par le
 * navigateur est déclaratif : n'importe qui peut envoyer un exécutable en
 * annonçant image/png. On vérifie donc les premiers octets du file.
 */
const SIGNATURES: { type: string; bytes: number[]; offset: number }[] = [
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff], offset: 0 },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 },
  { type: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  { type: 'image/avif', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
];

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private readonly minio: Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET ?? 'products';
    this.minio = new Client({
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
      if (!(await this.minio.bucketExists(this.bucket))) {
        await this.minio.makeBucket(this.bucket);
        this.logger.log(`Bucket « ${this.bucket} » créé.`);
      }
    } catch (error) {
      // Ne pas empêcher l'API de démarrer : seul l'upload sera indisponible.
      this.logger.error(`MinIO injoignable : ${(error as Error).message}`);
    }
  }

  /**
   * Range une photo et renvoie sa clé. Le bucket reste privé : la lecture passe
   * par `read()`, derrière l'authentification, jamais par une URL publique.
   *
   * La clé est préfixée par l'entreprise — cloisonnement du stockage, et un
   * inventaire du bucket reste lisible.
   */
  async savePhoto(companyId: string, file: Express.Multer.File): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier vide.');
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `Image trop lourde (${Math.round(file.size / 1024 / 1024)} Mo). Maximum ${MAX_SIZE_BYTES / 1024 / 1024} Mo.`,
      );
    }

    const type = this.realType(file.buffer);
    if (!type) {
      throw new BadRequestException(
        `Format non reconnu. Formats acceptés : ${Object.values(ALLOWED_TYPES).join(', ')}.`,
      );
    }

    const key = `${companyId}/${randomUUID()}.${ALLOWED_TYPES[type]}`;
    await this.minio.putObject(this.bucket, key, file.buffer, file.size, {
      'Content-Type': type,
    });
    return key;
  }

  /** Flux de lecture d'une photo, scopé à l'entreprise via le préfixe de clé. */
  async read(companyId: string, key: string): Promise<{ stream: Readable; type: string }> {
    if (!key.startsWith(`${companyId}/`)) {
      // Le préfixe fait office de contrôle d'accès : une clé d'une autre
      // entreprise est traitée comme inexistante.
      throw new NotFoundException('Photo introuvable.');
    }
    try {
      const stat = await this.minio.statObject(this.bucket, key);
      const stream = await this.minio.getObject(this.bucket, key);
      const declared: unknown = stat.metaData?.['content-type'];
      return {
        stream,
        type: typeof declared === 'string' ? declared : 'application/octet-stream',
      };
    } catch {
      throw new NotFoundException('Photo introuvable.');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.minio.removeObject(this.bucket, key);
    } catch (error) {
      // Une photo orpheline dans le bucket est moins grave qu'une suppression
      // de produit qui échoue : on trace et on continue.
      this.logger.warn(`Suppression de « ${key} » impossible : ${(error as Error).message}`);
    }
  }

  private realType(buffer: Buffer): string | null {
    for (const { type, bytes, offset } of SIGNATURES) {
      if (bytes.every((o, i) => buffer[offset + i] === o)) return type;
    }
    return null;
  }
}
