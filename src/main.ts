import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common'; // sequencia de etapas que a requisicao passa dentro do Nest (create-user.dto.ts)
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // impede que campos extras no body seja aceito pela requisicao
  app.useGlobalPipes(
    // o ValidationPipe verifica o corpo da requisicao usando as regras do ./user/dto/create-user.dto.ts
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(3000);
}

bootstrap();
