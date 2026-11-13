import { Test, TestingModule } from '@nestjs/testing';
import { AvaliacoesLojaController } from './avaliacoes-loja.controller.js';
import { AvaliacoesLojaService } from './avaliacoes-loja.service.js';

describe('AvaliacoesLojaController', () => {
  let controller: AvaliacoesLojaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvaliacoesLojaController],
      providers: [AvaliacoesLojaService],
    }).compile();

    controller = module.get<AvaliacoesLojaController>(AvaliacoesLojaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
