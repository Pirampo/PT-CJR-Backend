import { Module } from '@nestjs/common';
import { ComentariosController } from './comentarios.controller.js';
import { ComentariosService } from './comentarios.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  controllers: [ComentariosController],
  providers: [ComentariosService],
  imports: [PrismaModule]
})
export class ComentariosModule {}
