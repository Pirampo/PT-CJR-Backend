import { Module } from '@nestjs/common';
import { AvaliacoesLojaService } from './avaliacoes-loja.service.js';
import { AvaliacoesLojaController } from './avaliacoes-loja.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [AvaliacoesLojaController],
  providers: [AvaliacoesLojaService],
})
export class AvaliacoesLojaModule {}
