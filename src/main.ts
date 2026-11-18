import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common'; // sequencia de etapas que a requisicao passa dentro do Nest (create-user.dto.ts)
import 'dotenv/config';
import { ObserveInstrument } from './app.module.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });
  app.useGlobalPipes(
    // o ValidationPipe verifica o corpo da requisicao usando as regras do ./user/dto/create-user.dto.ts
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // CORS: libera o front em desenvolvimento em qualquer porta de localhost/127.0.0.1
  // (o Next sobe na 3002, por exemplo, quando a 3000 já está ocupada).
  // Para liberar outros endereços (IP da rede, site publicado), defina CORS_ORIGINS
  // no .env, separando por vírgula. Ex.: CORS_ORIGINS=http://192.168.0.10:3000
  const origensExtras = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);
  app.enableCors({
    origin: [/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, ...origensExtras],
  });

  // A porta continua sendo a 3001; PORT no .env só serve para trocar quando for preciso
  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
