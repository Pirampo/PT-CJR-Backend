import { PrismaService } from '../prisma/prisma.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CategoriasService } from './categorias.service.js';

describe('CategoriasService', () => {
  let service: CategoriasService;
  const prisma = {
    categorias: { findUnique: vi.fn(), count: vi.fn(), delete: vi.fn() },
    produtos: { count: vi.fn() },
    lojas: { count: vi.fn() },
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriasService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoriasService>(CategoriasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('não exclui categoria usada por produtos, lojas ou subcategorias', async () => {
    prisma.categorias.findUnique.mockResolvedValue({ id: 3, nome: 'Moda' });
    prisma.produtos.count.mockResolvedValue(2);
    prisma.lojas.count.mockResolvedValue(0);
    prisma.categorias.count.mockResolvedValue(0);

    await expect(service.remove(3)).rejects.toThrow(ConflictException);
    expect(prisma.categorias.delete).not.toHaveBeenCalled();
  });

  it('exclui categoria sem uso', async () => {
    prisma.categorias.findUnique.mockResolvedValue({ id: 4, nome: 'Vazia' });
    prisma.produtos.count.mockResolvedValue(0);
    prisma.lojas.count.mockResolvedValue(0);
    prisma.categorias.count.mockResolvedValue(0);
    prisma.categorias.delete.mockResolvedValue({ id: 4, nome: 'Vazia' });

    await expect(service.remove(4)).resolves.toEqual({ id: 4, nome: 'Vazia' });
    expect(prisma.categorias.delete).toHaveBeenCalledWith({ where: { id: 4 } });
  });

  it('responde 404 ao excluir categoria inexistente', async () => {
    prisma.categorias.findUnique.mockResolvedValue(null);
    await expect(service.remove(99)).rejects.toThrow(NotFoundException);
  });
});
