import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common'; // sequencia de etapas que a requisicao passa dentro do Nest (create-user.dto.ts)
import 'dotenv/config';
import { ObserveInstrument } from './app.module.js';
import { configurarUploads } from './uploads-static.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  }); // impede que campos extras no body seja aceito pela requisicao
  app.useGlobalPipes(
    // o ValidationPipe verifica o corpo da requisicao usando as regras do ./user/dto/create-user.dto.ts
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: 'http://localhost:3000' });
  configurarUploads(app);
  await app.listen(3001);
}

void bootstrap();
