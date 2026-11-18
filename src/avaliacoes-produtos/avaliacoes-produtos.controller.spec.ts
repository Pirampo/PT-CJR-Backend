import { Test, TestingModule } from '@nestjs/testing';
import { AvaliacoesProdutosController } from './avaliacoes-produtos.controller.js';
import { AvaliacoesProdutosService } from './avaliacoes-produtos.service.js';

describe('AvaliacoesProdutosController', () => {
  let controller: AvaliacoesProdutosController;

  // Service falso: aqui só interessa o que o controller repassa para ele
  const service = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvaliacoesProdutosController],
      providers: [{ provide: AvaliacoesProdutosService, useValue: service }],
    }).compile();

    controller = module.get<AvaliacoesProdutosController>(
      AvaliacoesProdutosController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('repassa os filtros da URL para a listagem', async () => {
    await controller.findAll(5, undefined);

    expect(service.findAll).toHaveBeenCalledWith({
      produto_id: 5,
      usuario_id: undefined,
    });
  });

  it('cria a avaliação com o id do usuário que está no token', async () => {
    const dto = { produto_id: 1, nota: 5 };

    await controller.create(dto, { sub: 7, email: 'a@b.com' });

    expect(service.create).toHaveBeenCalledWith(7, dto);
  });
});
