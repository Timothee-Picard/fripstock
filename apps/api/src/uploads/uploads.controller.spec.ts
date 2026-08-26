import { StreamableFile } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Response } from 'express';
import { UploadsController } from './uploads.controller';
import type { UploadsService } from './uploads.service';
import { prefix, route } from '../test/routes';
import { COMPANY_ID, manager } from '../test/fixtures';

describe('UploadsController', () => {
  const uploads = {
    savePhoto: jest.fn().mockResolvedValue('company-1/x.png'),
    read: jest.fn().mockResolvedValue({ stream: Readable.from(['x']), type: 'image/png' }),
  };
  const controller = new UploadsController(uploads as unknown as UploadsService);

  function reponse() {
    return { set: jest.fn() } as unknown as Response & { set: jest.Mock };
  }

  beforeEach(() => jest.clearAllMocks());

  it('est monté sur /uploads', () => {
    expect(prefix(UploadsController)).toBe('uploads');
  });

  it('déposer une photo coûte la permission de créer un produit', () => {
    expect(route(UploadsController, 'upload')).toMatchObject({
      method: 'POST',
      path: 'photo',
      permission: 'products.create',
    });
  });

  it('la lecture est authentifiée, sans permission fine', () => {
    expect(route(UploadsController, 'read')).toMatchObject({
      method: 'GET',
      path: 'photo/*key',
      public: false,
      permission: undefined,
    });
  });

  it("range la photo sous l'entreprise du jeton et rend sa clé", async () => {
    await expect(
      controller.upload(manager, { buffer: Buffer.alloc(1) } as Express.Multer.File),
    ).resolves.toEqual({ key: 'company-1/x.png' });
    expect(uploads.savePhoto).toHaveBeenCalledWith(COMPANY_ID, expect.anything());
  });

  it('recolle une clé découpée sur les slashs', async () => {
    await controller.read(manager, ['company-1', 'x.png'], reponse());
    expect(uploads.read).toHaveBeenCalledWith(COMPANY_ID, 'company-1/x.png');
  });

  it('accepte aussi une clé déjà entière', async () => {
    await controller.read(manager, 'company-1/x.png', reponse());
    expect(uploads.read).toHaveBeenCalledWith(COMPANY_ID, 'company-1/x.png');
  });

  it('pose le type et un cache immuable, la clé portant un UUID', async () => {
    const res = reponse();
    await controller.read(manager, 'company-1/x.png', res);
    expect(res.set).toHaveBeenCalledWith({
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=31536000, immutable',
    });
  });

  it('diffuse le flux au lieu de le sérialiser en JSON', async () => {
    await expect(controller.read(manager, 'company-1/x.png', reponse())).resolves.toBeInstanceOf(
      StreamableFile,
    );
  });
});
