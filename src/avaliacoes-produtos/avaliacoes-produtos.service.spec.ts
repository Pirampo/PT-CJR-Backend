import { Test, TestingModule } from '@nestjs/testing';
import { AvaliacoesProdutosService } from './avaliacoes-produtos.service.js';

describe('AvaliacoesProdutosService', () => {
  let service: AvaliacoesProdutosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AvaliacoesProdutosService],
    }).compile();

    service = module.get<AvaliacoesProdutosService>(AvaliacoesProdutosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
