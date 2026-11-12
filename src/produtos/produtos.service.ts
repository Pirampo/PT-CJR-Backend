import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  RequestTimeoutException,
  BadRequestException,
} from '@nestjs/common';
import { CreateProdutoDto } from './dto/create-produto.dto.js';
import { UpdateProdutoDto } from './dto/update-produto.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usuarioId: number, createProdutoDto: CreateProdutoDto) {
    const loja = await this.prisma.lojas.findFirst({
      where: {
        id: createProdutoDto.loja_id,
        usuario_id: usuarioId,
      },
    });

    if (!loja) {
      throw new ForbiddenException(
        'Você não tem permissão para criar produtos nesta loja.',
      );
    }
    return this.prisma.produtos.create({
      data: createProdutoDto,
    });
  }

  findByUser(userId: number) {
    return this.prisma.produtos.findMany({
      where: { lojas: { usuario_id: userId } },
      include: { imagem: true },
    });
  }

  findAll() {
    return this.prisma.produtos.findMany({
      include: {
        imagem: {
          orderBy: { ordem: 'asc' },
        },
      },
    });
  }

  async findOne(id: number) {
    const produto = await this.prisma.produtos.findUnique({
      where: { id },
    });

    if (!produto) {
      throw new NotFoundException(`Produto com ID ${id} não encontrado!`);
    }

    return produto;
  }

  async update(
    id: number,
    usuarioId: number,
    updateProdutoDto: UpdateProdutoDto,
  ) {
    const produto = await this.prisma.produtos.findUnique({
      where: { id },
      include: {
        lojas: true,
      },
    });

    if (!produto) {
      throw new NotFoundException(`Produto com ID ${id} não encontrado!`);
    }

    if (produto.lojas.usuario_id !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para atualizar este produto.',
      );
    }

    const { loja_id: _lojaId, ...dados } = updateProdutoDto;

    return this.prisma.produtos.update({
      where: { id },
      data: dados,
    });
  }

  async remove(id: number, usuario_id: number) {
    const produto = await this.prisma.produtos.findUnique({
      where: { id },
      include: {
        lojas: true,
      },
    });

    if (!produto) {
      throw new NotFoundException(`Produto com ID ${id} não encontrado!`);
    }

    if (produto.lojas.usuario_id !== usuario_id) {
      throw new ForbiddenException(
        'Você não tem permissão para excluir este produto.',
      );
    }

    return this.prisma.produtos.delete({
      where: { id },
    });
  }

  async uploadImagem(
    id: number,
    usuarioId: number,
    file: {
      buffer: Buffer;
      mimetype: string;
    },
  ) {
    const produto = await this.prisma.produtos.findUnique({
      where: { id },
      include: {
        lojas: true,
        imagem: true,
      },
    });

    if (!produto) {
      throw new NotFoundException('Produto não encontrado.');
    }

    if (produto.lojas.usuario_id !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar este produto.',
      );
    }

    const extensoes: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };

    const extensao = extensoes[file.mimetype];

    if (!extensao) {
      throw new BadRequestException('Formato de imagem não permitido.');
    }

    const nomeArquivo = `${randomUUID()}.${extensao}`;

    const pasta = join(process.cwd(), 'uploads', 'produtos');

    await mkdir(pasta, { recursive: true });

    await writeFile(join(pasta, nomeArquivo), file.buffer);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.imagens_Produtos.deleteMany({
          where: { produto_id: id },
        });

        return tx.imagens_Produtos.create({
          data: {
            produto_id: id,
            url_imagem: `/uploads/produtos/${nomeArquivo}`,
          },
        });
      });
    } catch (error) {
      const { unlink } = await import('node:fs/promises');
      await unlink(join(pasta, nomeArquivo));
      throw error;
    }
  }
}
