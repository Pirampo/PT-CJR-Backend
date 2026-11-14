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
import { mkdir, writeFile, unlink } from 'node:fs/promises';
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
      include: {
        imagem: {
          orderBy: { ordem: 'asc' },
        },
      },
    });

    if (!produto) {
      throw new NotFoundException(`Produto com ID ${id} não encontrado!`);
    }

    return produto;
  }

  async listarImagens(produtoId: number) {
    const produto = await this.findOne(produtoId);

    return produto.imagem;
  }

  async buscarImagem(produtoId: number, imagemId: number) {
    const imagem = await this.prisma.imagens_Produtos.findFirst({
      where: {
        id: imagemId,
        produto_id: produtoId,
      },
    });

    if (!imagem) {
      throw new NotFoundException(
        'Imagem não encontrada para este produto.',
      );
    }

    return imagem;
  }

  async substituirImagem(
    produtoId: number,
    imagemId: number,
    usuarioId: number,
    file: {
      buffer: Buffer;
      mimetype: string;
    },
  ) {
    const produto = await this.prisma.produtos.findUnique({
      where: { id: produtoId },
      include: { lojas: true },
    });

    if (!produto) {
      throw new NotFoundException('Produto não encontrado.');
    }

    if (produto.lojas.usuario_id !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar este produto.',
      );
    }

    const imagemAtual = await this.buscarImagem(produtoId, imagemId);

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

    let imagemAtualizada;

    try {
      imagemAtualizada = await this.prisma.imagens_Produtos.update({
        where: { id: imagemId },
        data: {
          url_imagem: `/uploads/produtos/${nomeArquivo}`,
        },
      });
    } catch (error) {
      await unlink(join(pasta, nomeArquivo)).catch(() => undefined);
      throw error;
    }

    const nomeAntigo = imagemAtual.url_imagem.split('/').pop();

    if (
      nomeAntigo &&
      /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(nomeAntigo)
    ) {
      await unlink(join(pasta, nomeAntigo)).catch((error) => {
        console.warn('Não foi possível excluir o arquivo antigo:', error);
      });
    }

    return imagemAtualizada;
  }

  async removerImagem(
    produtoId: number,
    imagemId: number,
    usuarioId: number,
  ) {
    const produto = await this.prisma.produtos.findUnique({
      where: { id: produtoId },
      include: { lojas: true },
    });

    if (!produto) {
      throw new NotFoundException('Produto não encontrado.');
    }

    if (produto.lojas.usuario_id !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar este produto.',
      );
    }

    const imagem = await this.buscarImagem(produtoId, imagemId);

    const removida = await this.prisma.$transaction(async (tx) => {
      const resultado = await tx.imagens_Produtos.delete({
        where: { id: imagemId },
      });

      await tx.imagens_Produtos.updateMany({
        where: {
          produto_id: produtoId,
          ordem: { gt: imagem.ordem },
        },
        data: {
          ordem: { decrement: 1 },
        },
      });

      return resultado;
    });

    const nomeArquivo = imagem.url_imagem.split('/').pop();

    if (
      nomeArquivo &&
      /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(nomeArquivo)
    ) {
      const pasta = join(process.cwd(), 'uploads', 'produtos');

      await unlink(join(pasta, nomeArquivo)).catch((error) => {
        console.warn('Não foi possível excluir o arquivo:', error);
      });
    }

    return removida;
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
        imagem: true,
      },
    });

    if (!produto) {
      throw new NotFoundException(
        `Produto com ID ${id} não encontrado!`,
      );
    }

    if (produto.lojas.usuario_id !== usuario_id) {
      throw new ForbiddenException(
        'Você não tem permissão para excluir este produto.',
      );
    }

    // Exclui o produto do banco.
    // As imagens serão excluídas automaticamente
    // graças ao onDelete: Cascade do Prisma.
    const removido = await this.prisma.produtos.delete({
      where: { id },
    });

    // Exclui os arquivos físicos das imagens.
    const pasta = join(process.cwd(), 'uploads', 'produtos');

    for (const imagem of produto.imagem) {
      const nomeArquivo = imagem.url_imagem.split('/').pop();

      if (
        nomeArquivo &&
        /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(nomeArquivo)
      ) {
        await unlink(join(pasta, nomeArquivo)).catch((error) => {
          console.warn(
            'Não foi possível excluir o arquivo:',
            error,
          );
        });
      }
    }

    return removido;
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
      const ultimaImagem = await this.prisma.imagens_Produtos.findFirst({
        where: { produto_id: id },
        orderBy: { ordem: 'desc' },
      });

      const proximaOrdem = (ultimaImagem?.ordem ?? -1) + 1;

      return await this.prisma.imagens_Produtos.create({
        data: {
          produto_id: id,
          url_imagem: `/uploads/produtos/${nomeArquivo}`,
          ordem: proximaOrdem,
        },
      });
    } catch (error) {
      const { unlink } = await import('node:fs/promises');
      await unlink(join(pasta, nomeArquivo)).catch(() => undefined);
      throw error;
    }

  }
}
