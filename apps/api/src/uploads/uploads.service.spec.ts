import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Client } from 'minio';
import { MAX_SIZE_BYTES, UploadsService } from './uploads.service';

jest.mock('minio', () => ({ Client: jest.fn() }));

/** Un tampon dont les premiers octets imitent le format demandé. */
function image(type: 'jpeg' | 'png' | 'webp' | 'avif' | 'inconnu', taille = 32): Buffer {
  const buffer = Buffer.alloc(taille);
  const entetes: Record<string, { bytes: number[]; offset: number }> = {
    jpeg: { bytes: [0xff, 0xd8, 0xff], offset: 0 },
    png: { bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 },
    webp: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
    avif: { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  };
  const entete = entetes[type];
  if (entete) entete.bytes.forEach((b, i) => (buffer[entete.offset + i] = b));
  else buffer.write('MZ');
  return buffer;
}

function fichier(buffer: Buffer, size = buffer.length): Express.Multer.File {
  return { buffer, size } as Express.Multer.File;
}

describe('UploadsService', () => {
  let minio: {
    bucketExists: jest.Mock;
    makeBucket: jest.Mock;
    putObject: jest.Mock;
    statObject: jest.Mock;
    getObject: jest.Mock;
    removeObject: jest.Mock;
  };
  let service: UploadsService;

  beforeEach(() => {
    minio = {
      bucketExists: jest.fn().mockResolvedValue(true),
      makeBucket: jest.fn().mockResolvedValue(undefined),
      putObject: jest.fn().mockResolvedValue(undefined),
      statObject: jest.fn().mockResolvedValue({ metaData: { 'content-type': 'image/png' } }),
      getObject: jest.fn().mockResolvedValue('flux'),
      removeObject: jest.fn().mockResolvedValue(undefined),
    };
    (Client as unknown as jest.Mock).mockImplementation(() => minio);
    service = new UploadsService();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('onModuleInit', () => {
    it('crée le bucket s’il manque', async () => {
      minio.bucketExists.mockResolvedValue(false);
      await service.onModuleInit();
      expect(minio.makeBucket).toHaveBeenCalled();
    });

    it('ne recrée pas un bucket existant', async () => {
      await service.onModuleInit();
      expect(minio.makeBucket).not.toHaveBeenCalled();
    });

    it("laisse l'API démarrer même si MinIO est injoignable", async () => {
      const erreur = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      minio.bucketExists.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(erreur).toHaveBeenCalledWith(expect.stringContaining('injoignable'));
    });
  });

  describe('savePhoto', () => {
    it.each(['jpeg', 'png', 'webp', 'avif'] as const)('accepte une image %s', async (type) => {
      const key = await service.savePhoto('company-1', fichier(image(type)));
      expect(key).toMatch(/^company-1\//);
      expect(minio.putObject).toHaveBeenCalled();
    });

    it('préfixe la clé par l’entreprise — cloisonnement du stockage', async () => {
      const key = await service.savePhoto('company-1', fichier(image('png')));
      expect(key.startsWith('company-1/')).toBe(true);
    });

    it('donne à chaque photo une clé unique', async () => {
      const a = await service.savePhoto('c', fichier(image('png')));
      const b = await service.savePhoto('c', fichier(image('png')));
      expect(a).not.toBe(b);
    });

    it('refuse un fichier vide', async () => {
      await expect(service.savePhoto('c', fichier(Buffer.alloc(0)))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuse un fichier absent', async () => {
      await expect(
        service.savePhoto('c', undefined as unknown as Express.Multer.File),
      ).rejects.toThrow('Fichier vide.');
    });

    it('refuse une image trop lourde', async () => {
      await expect(
        service.savePhoto('c', fichier(image('png'), MAX_SIZE_BYTES + 1)),
      ).rejects.toThrow('trop lourde');
    });

    it('se fie au contenu et non au type déclaré par le navigateur', async () => {
      const executable = fichier(image('inconnu'));
      (executable as { mimetype?: string }).mimetype = 'image/png';
      await expect(service.savePhoto('c', executable)).rejects.toThrow('Format non reconnu');
      expect(minio.putObject).not.toHaveBeenCalled();
    });
  });

  describe('read', () => {
    it('rend le flux et le type déclaré', async () => {
      await expect(service.read('company-1', 'company-1/x.png')).resolves.toEqual({
        stream: 'flux',
        type: 'image/png',
      });
    });

    it("traite la clé d'une autre entreprise comme inexistante", async () => {
      await expect(service.read('company-1', 'company-2/x.png')).rejects.toThrow(NotFoundException);
      expect(minio.statObject).not.toHaveBeenCalled();
    });

    it('retombe sur un type générique si MinIO n’en donne pas', async () => {
      minio.statObject.mockResolvedValue({ metaData: {} });
      await expect(service.read('c', 'c/x')).resolves.toMatchObject({
        type: 'application/octet-stream',
      });
    });

    it('traduit une erreur de stockage en photo introuvable', async () => {
      minio.statObject.mockRejectedValue(new Error('NoSuchKey'));
      await expect(service.read('c', 'c/x')).rejects.toThrow('Photo introuvable.');
    });
  });

  describe('delete', () => {
    it('supprime la photo', async () => {
      await service.delete('c/x.png');
      expect(minio.removeObject).toHaveBeenCalledWith(expect.any(String), 'c/x.png');
    });

    it("n'échoue pas si le stockage refuse : une photo orpheline est moins grave", async () => {
      const avertir = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      minio.removeObject.mockRejectedValue(new Error('boum'));
      await expect(service.delete('c/x.png')).resolves.toBeUndefined();
      expect(avertir).toHaveBeenCalled();
    });
  });
});
