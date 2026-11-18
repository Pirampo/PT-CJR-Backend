import { PrismaService } from '../prisma/prisma.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import { AvaliacoesProdutosController } from './avaliacoes-produtos.controller.js';
import { AvaliacoesProdutosService } from './avaliacoes-produtos.service.js';

describe('AvaliacoesProdutosController', () => {
  let controller: AvaliacoesProdutosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvaliacoesProdutosController],
      providers: [AvaliacoesProdutosService, { provide: PrismaService, useValue: {} }],
    }).compile();

    controller = module.get<AvaliacoesProdutosController>(AvaliacoesProdutosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
