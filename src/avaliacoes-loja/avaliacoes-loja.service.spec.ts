import { Test, TestingModule } from '@nestjs/testing';
import { AvaliacoesLojaService } from './avaliacoes-loja.service.js';

describe('AvaliacoesLojaService', () => {
  let service: AvaliacoesLojaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AvaliacoesLojaService],
    }).compile();

    service = module.get<AvaliacoesLojaService>(AvaliacoesLojaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
