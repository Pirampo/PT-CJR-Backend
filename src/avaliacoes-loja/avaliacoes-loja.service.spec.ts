import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AvaliacoesLojaService } from './avaliacoes-loja.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AvaliacoesLojaService', () => {
  let service: AvaliacoesLojaService;

  // Prisma falso: os testes não tocam no banco de verdade
  const prisma = {
    lojas: { findUnique: vi.fn() },
    avaliacoes_Loja: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvaliacoesLojaService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AvaliacoesLojaService>(AvaliacoesLojaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('recusa avaliar uma loja que não existe', async () => {
      prisma.lojas.findUnique.mockResolvedValue(null);

      await expect(
        service.create(1, { loja_id: 99, nota: 5 }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.avaliacoes_Loja.create).not.toHaveBeenCalled();
    });

    it('grava a avaliação no nome do usuário logado', async () => {
      prisma.lojas.findUnique.mockResolvedValue({ id: 1 });
      prisma.avaliacoes_Loja.create.mockResolvedValue({ id: 10 });

      await service.create(7, { loja_id: 1, nota: 4, comentario: 'Boa' });

      expect(prisma.avaliacoes_Loja.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { loja_id: 1, nota: 4, comentario: 'Boa', usuario_id: 7 },
        }),
      );
    });
  });

  describe('findAll', () => {
    it('devolve todas quando não há filtro', async () => {
      prisma.avaliacoes_Loja.findMany.mockResolvedValue([]);

      await service.findAll();

      const consulta = prisma.avaliacoes_Loja.findMany.mock.calls[0][0];
      expect(consulta.where.loja_id).toBeUndefined();
      expect(consulta.where.usuario_id).toBeUndefined();
    });

    it('filtra pela loja quando loja_id é informado', async () => {
      prisma.avaliacoes_Loja.findMany.mockResolvedValue([]);

      await service.findAll({ loja_id: 3 });

      const consulta = prisma.avaliacoes_Loja.findMany.mock.calls[0][0];
      expect(consulta.where.loja_id).toBe(3);
    });

    it('inclui nome e foto do autor, sem dados sensíveis', async () => {
      prisma.avaliacoes_Loja.findMany.mockResolvedValue([]);

      await service.findAll();

      const consulta = prisma.avaliacoes_Loja.findMany.mock.calls[0][0];
      expect(consulta.include.usuario.select).toEqual({
        id: true,
        nome: true,
        username: true,
        foto_perfil_url: true,
      });
    });
  });

  describe('findOne', () => {
    it('avisa quando a avaliação não existe', async () => {
      prisma.avaliacoes_Loja.findUnique.mockResolvedValue(null);

      await expect(service.findOne(123)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('recusa alterar a avaliação de outro usuário', async () => {
      prisma.avaliacoes_Loja.findUnique.mockResolvedValue({
        id: 1,
        usuario_id: 2,
      });

      await expect(service.update(1, 99, { nota: 1 })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.avaliacoes_Loja.update).not.toHaveBeenCalled();
    });

    it('não deixa trocar a loja da avaliação', async () => {
      prisma.avaliacoes_Loja.findUnique.mockResolvedValue({
        id: 1,
        usuario_id: 2,
      });
      prisma.avaliacoes_Loja.update.mockResolvedValue({ id: 1 });

      await service.update(1, 2, { loja_id: 50, nota: 3 });

      const alteracao = prisma.avaliacoes_Loja.update.mock.calls[0][0];
      expect(alteracao.data).toEqual({ nota: 3, comentario: undefined });
      expect(alteracao.data).not.toHaveProperty('loja_id');
    });
  });

  describe('remove', () => {
    it('recusa excluir a avaliação de outro usuário', async () => {
      prisma.avaliacoes_Loja.findUnique.mockResolvedValue({
        id: 1,
        usuario_id: 2,
      });

      await expect(service.remove(1, 99)).rejects.toThrow(ForbiddenException);
      expect(prisma.avaliacoes_Loja.delete).not.toHaveBeenCalled();
    });

    it('exclui quando quem pede é o autor', async () => {
      prisma.avaliacoes_Loja.findUnique.mockResolvedValue({
        id: 1,
        usuario_id: 2,
      });
      prisma.avaliacoes_Loja.delete.mockResolvedValue({ id: 1 });

      await service.remove(1, 2);

      expect(prisma.avaliacoes_Loja.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });
});
