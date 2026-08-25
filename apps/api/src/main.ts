import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validation des DTOs sur tous les endpoints qui reçoivent un body.
  // `whitelist` retire les champs non déclarés dans le DTO plutôt que de les
  // laisser filer jusqu'à Prisma — indispensable dès qu'on manipulera des
  // ressources scopées par entreprise.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 0.0.0.0 et pas localhost : dans le conteneur, écouter sur la loopback
  // rendrait le port injoignable depuis l'hôte et depuis le service web.
  await app.listen(process.env.API_PORT ?? 3001, '0.0.0.0');
}
void bootstrap();
