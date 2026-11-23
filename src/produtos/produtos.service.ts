import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateProdutoDto } from './dto/create-produto.dto.js';
import { UpdateProdutoDto } from './dto/update-produto.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  converterImagem,
  gravarImagem,
  removerArquivo,
  removerImagemProduto,
  LIMITE_FOTO,
  LIMITE_IMAGEM_PRODUTO,
} from '../imagens/arquivo-imagem.js';

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  async adicionarImagem(
    id: number,
    usuarioId: number,
    arquivo: Express.Multer.File | undefined,
    limite = LIMITE_FOTO,
  ) {
    const produto = await this.prisma.produtos.findUnique({
      where: { id },
      include: { lojas: true },
    });
    if (!produto) throw new NotFoundException('Produto não encontrado.');
    if (produto.lojas.usuario_id !== usuarioId)
      throw new ForbiddenException(
        'Você não tem permissão para alterar este produto.',
      );
    const conteudo = await converterImagem(arquivo, false, limite);
    const imagem = await gravarImagem('produtos', id, conteudo);
    try {
      const ultima = await this.prisma.imagens_Produtos.aggregate({
        where: { produto_id: id },
        _max: { ordem: true },
      });
      return await this.prisma.imagens_Produtos.create({
        data: {
          produto_id: id,
          url_imagem: imagem.url,
          ordem: (ultima._max.ordem ?? -1) + 1,
        },
      });
    } catch (erro) {
      await removerArquivo(imagem.caminho);
      throw erro;
    }
  }

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
      include: { imagem: { orderBy: { ordem: 'asc' } } },
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
      throw new NotFoundException('Imagem não encontrada para este produto.');
    }

    return imagem;
  }

  async substituirImagem(
    produtoId: number,
    imagemId: number,
    usuarioId: number,
    file: Express.Multer.File,
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

    const conteudo = await converterImagem(file, false, LIMITE_IMAGEM_PRODUTO);
    const nova = await gravarImagem('produtos', produtoId, conteudo);
    let imagemAtualizada;
    try {
      imagemAtualizada = await this.prisma.imagens_Produtos.update({
        where: { id: imagemId },
        data: { url_imagem: nova.url },
      });
    } catch (erro) {
      await removerArquivo(nova.caminho);
      throw erro;
    }
    await removerImagemProduto(produtoId, imagemAtual.url_imagem);

    return imagemAtualizada;
  }

  async removerImagem(produtoId: number, imagemId: number, usuarioId: number) {
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

    await removerImagemProduto(produtoId, imagem.url_imagem);

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
      throw new NotFoundException(`Produto com ID ${id} não encontrado!`);
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

    for (const imagem of produto.imagem) {
      await removerImagemProduto(id, imagem.url_imagem);
    }

    return removido;
  }

  async uploadImagem(id: number, usuarioId: number, file: Express.Multer.File) {
    return this.adicionarImagem(id, usuarioId, file, LIMITE_IMAGEM_PRODUTO);
  }
}
