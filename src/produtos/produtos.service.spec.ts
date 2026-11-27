import { PrismaService } from '../prisma/prisma.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import { ProdutosService } from './produtos.service.js';

describe('ProdutosService', () => {
  let service: ProdutosService;
  const prisma = { produtos: { findMany: vi.fn() } };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdutosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProdutosService>(ProdutosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lista produtos com média e total de avaliações, sem expor as notas', async () => {
    prisma.produtos.findMany.mockResolvedValue([
      {
        id: 1,
        nome: 'A',
        imagem: [],
        produto: [{ nota: 5 }, { nota: 4 }, { nota: 4 }],
      },
      { id: 2, nome: 'B', imagem: [], produto: [] },
    ]);

    const produtos = await service.findAll();

    expect(produtos).toEqual([
      {
        id: 1,
        nome: 'A',
        imagem: [],
        media_avaliacoes: 4.33,
        total_avaliacoes: 3,
      },
      {
        id: 2,
        nome: 'B',
        imagem: [],
        media_avaliacoes: null,
        total_avaliacoes: 0,
      },
    ]);
  });
});
