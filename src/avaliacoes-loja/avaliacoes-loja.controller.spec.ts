import { Test, TestingModule } from '@nestjs/testing';
import { AvaliacoesLojaController } from './avaliacoes-loja.controller.js';
import { AvaliacoesLojaService } from './avaliacoes-loja.service.js';

describe('AvaliacoesLojaController', () => {
  let controller: AvaliacoesLojaController;

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
      controllers: [AvaliacoesLojaController],
      providers: [{ provide: AvaliacoesLojaService, useValue: service }],
    }).compile();

    controller = module.get<AvaliacoesLojaController>(AvaliacoesLojaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('repassa os filtros da URL para a listagem', async () => {
    await controller.findAll(3, undefined);

    expect(service.findAll).toHaveBeenCalledWith({
      loja_id: 3,
      usuario_id: undefined,
    });
  });

  it('cria a avaliação com o id do usuário que está no token', async () => {
    const dto = { loja_id: 1, nota: 5 };

    await controller.create(dto, { sub: 7, email: 'a@b.com' });

    expect(service.create).toHaveBeenCalledWith(7, dto);
  });
});
