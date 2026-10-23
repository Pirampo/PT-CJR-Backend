import { Module } from '@nestjs/common';
import { ProdutosService } from './produtos.service.js';
import { ProdutosController } from './produtos.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ProdutosController],
  providers: [ProdutosService],
})
export class ProdutosModule {}