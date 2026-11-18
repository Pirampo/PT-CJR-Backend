import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common'; // sequencia de etapas que a requisicao passa dentro do Nest (create-user.dto.ts)
import 'dotenv/config';
import { ObserveInstrument } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configurarUploads } from './uploads-static.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
  });
  app.useGlobalPipes(
    // o ValidationPipe verifica o corpo da requisicao usando as regras do ./user/dto/create-user.dto.ts
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  });
  configurarUploads(app);
  await app.listen(Number(process.env.PORT ?? 3001));
}

void bootstrap();
