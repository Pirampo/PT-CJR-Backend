import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AvaliacoesProdutosService } from './avaliacoes-produtos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AvaliacoesProdutosService', () => {
  let service: AvaliacoesProdutosService;

  // Prisma falso: os testes não tocam no banco de verdade
  const prisma = {
    produtos: { findUnique: vi.fn() },
    avaliacoes_Produtos: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  // Como o Prisma devolve uma avaliação: o autor vem na relação "avaliacao_produto"
  const autor = { id: 2, nome: 'Ana', username: 'ana', foto_perfil_url: null };
  const doBanco = {
    id: 1,
    usuario_id: 2,
    produto_id: 5,
    nota: 4,
    comentario: 'Bom',
    avaliacao_produto: autor,
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvaliacoesProdutosService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AvaliacoesProdutosService>(AvaliacoesProdutosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('recusa avaliar um produto que não existe', async () => {
      prisma.produtos.findUnique.mockResolvedValue(null);

      await expect(
        service.create(1, { produto_id: 99, nota: 5 }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.avaliacoes_Produtos.create).not.toHaveBeenCalled();
    });

    it('grava a avaliação no nome do usuário logado', async () => {
      prisma.produtos.findUnique.mockResolvedValue({ id: 5 });
      prisma.avaliacoes_Produtos.create.mockResolvedValue(doBanco);

      await service.create(2, { produto_id: 5, nota: 4, comentario: 'Bom' });

      expect(prisma.avaliacoes_Produtos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { produto_id: 5, nota: 4, comentario: 'Bom', usuario_id: 2 },
        }),
      );
    });
  });

  describe('findAll', () => {
    it('filtra pelo produto quando produto_id é informado', async () => {
      prisma.avaliacoes_Produtos.findMany.mockResolvedValue([]);

      await service.findAll({ produto_id: 5 });

      const consulta = prisma.avaliacoes_Produtos.findMany.mock.calls[0][0];
      expect(consulta.where.produto_id).toBe(5);
    });

    it('devolve o autor no campo "usuario"', async () => {
      prisma.avaliacoes_Produtos.findMany.mockResolvedValue([doBanco]);

      const [avaliacao] = await service.findAll();

      expect(avaliacao.usuario).toEqual(autor);
      expect(avaliacao).not.toHaveProperty('avaliacao_produto');
      expect(avaliacao.nota).toBe(4);
    });
  });

  describe('findOne', () => {
    it('avisa quando a avaliação não existe', async () => {
      prisma.avaliacoes_Produtos.findUnique.mockResolvedValue(null);

      await expect(service.findOne(123)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('recusa alterar a avaliação de outro usuário', async () => {
      prisma.avaliacoes_Produtos.findUnique.mockResolvedValue(doBanco);

      await expect(service.update(1, 99, { nota: 1 })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.avaliacoes_Produtos.update).not.toHaveBeenCalled();
    });

    it('não deixa trocar o produto da avaliação', async () => {
      prisma.avaliacoes_Produtos.findUnique.mockResolvedValue(doBanco);
      prisma.avaliacoes_Produtos.update.mockResolvedValue(doBanco);

      await service.update(1, 2, { produto_id: 50, nota: 3 });

      const alteracao = prisma.avaliacoes_Produtos.update.mock.calls[0][0];
      expect(alteracao.data).toEqual({ nota: 3, comentario: undefined });
      expect(alteracao.data).not.toHaveProperty('produto_id');
    });
  });

  describe('remove', () => {
    it('recusa excluir a avaliação de outro usuário', async () => {
      prisma.avaliacoes_Produtos.findUnique.mockResolvedValue(doBanco);

      await expect(service.remove(1, 99)).rejects.toThrow(ForbiddenException);
      expect(prisma.avaliacoes_Produtos.delete).not.toHaveBeenCalled();
    });

    it('exclui quando quem pede é o autor', async () => {
      prisma.avaliacoes_Produtos.findUnique.mockResolvedValue(doBanco);
      prisma.avaliacoes_Produtos.delete.mockResolvedValue({ id: 1 });

      await service.remove(1, 2);

      expect(prisma.avaliacoes_Produtos.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });
  it.each(['listagem', 'consulta', 'criação', 'edição'])(
    'protege username legado e dados privados na %s',
    async (operacao) => {
      const registro = {
        ...doBanco,
        avaliacao_produto: {
          ...autor,
          username: 'legado@example.test',
          email: 'privado@example.test',
          senha_hash: 'hash-ficticio',
        },
      };
      prisma.avaliacoes_Produtos.findMany.mockResolvedValue([registro]);
      prisma.avaliacoes_Produtos.findUnique.mockResolvedValue(registro);
      prisma.avaliacoes_Produtos.create.mockResolvedValue(registro);
      prisma.avaliacoes_Produtos.update.mockResolvedValue(registro);
      prisma.produtos.findUnique.mockResolvedValue({ id: 5 });
      const dto = { produto_id: 5, nota: 4 };
      const resultado =
        operacao === 'listagem'
          ? (await service.findAll())[0]
          : operacao === 'consulta'
            ? await service.findOne(1)
            : operacao === 'criação'
              ? await service.create(2, dto)
              : await service.update(1, 2, { nota: 4 });
      expect(resultado.usuario).toEqual({ ...autor, username: null });
      expect(resultado.usuario).not.toHaveProperty('email');
      expect(resultado.usuario).not.toHaveProperty('senha_hash');
    },
  );
});
