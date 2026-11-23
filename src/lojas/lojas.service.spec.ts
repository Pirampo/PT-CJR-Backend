import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LojasService } from './lojas.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('LojasService', () => {
  let service: LojasService;
  const prisma = {
    lojas: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [LojasService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<LojasService>(LojasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('recusa URL de imagem enviada na criação', () => {
    expect(() =>
      service.create(
        { nome: 'Loja', categoria_id: 1, banner_url: 'http://externo/x.png' },
        1,
      ),
    ).toThrow(BadRequestException);
    expect(prisma.lojas.create).not.toHaveBeenCalled();
  });

  it('impede upload de imagem por quem não é dono', async () => {
    prisma.lojas.findUnique.mockResolvedValue({ id: 3, usuario_id: 1 });
    await expect(
      service.adicionarFotoPerfil(3, 2, undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.lojas.update).not.toHaveBeenCalled();
  });

  it('recusa PATCH com URL de imagem externa', async () => {
    prisma.lojas.findFirst.mockResolvedValue({
      id: 3,
      usuario_id: 1,
      nome: 'Loja',
      banner_url: null,
      logo_url: null,
      sticker_url: null,
    });
    await expect(
      service.update(3, 1, { banner_url: 'javascript:alert(1)' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.lojas.update).not.toHaveBeenCalled();
  });

  it('aceita PATCH que repete a URL atual da imagem', async () => {
    const atual = 'http://localhost:3001/uploads/lojas/3/x.webp';
    prisma.lojas.findFirst.mockResolvedValue({
      id: 3,
      usuario_id: 1,
      nome: 'Loja',
      banner_url: atual,
      logo_url: null,
      sticker_url: null,
    });
    prisma.lojas.update.mockResolvedValue({ id: 3, nome: 'Loja' });
    await expect(
      service.update(3, 1, { banner_url: atual, descricao: 'nova' }),
    ).resolves.toEqual({ id: 3, nome: 'Loja' });
  });

  it('calcula médias fracionárias de loja e produtos', async () => {
    prisma.lojas.findUnique.mockResolvedValue({
      id: 3,
      produtos: [
        { id: 1, produto: [{ nota: 5 }, { nota: 4 }] },
        { id: 2, produto: [] },
      ],
      avaliacoes_loja: [{ nota: 5 }, { nota: 5 }, { nota: 5 }, { nota: 4 }],
    });
    const loja = await service.findOne(3);
    expect(loja.media_avaliacoes).toBe(4.75);
    expect(loja.total_avaliacoes).toBe(4);
    expect(loja.produtos[0]).toMatchObject({ media_avaliacoes: 4.5, total_avaliacoes: 2 });
    expect(loja.produtos[1]).toMatchObject({ media_avaliacoes: null, total_avaliacoes: 0 });
    expect(loja.produtos[0]).not.toHaveProperty('produto');
  });
});
