import { Module } from '@nestjs/common';
import { AvaliacoesProdutosService } from './avaliacoes-produtos.service.js';
import { AvaliacoesProdutosController } from './avaliacoes-produtos.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [AvaliacoesProdutosController],
  providers: [AvaliacoesProdutosService],
})
export class AvaliacoesProdutosModule {}