import { Injectable,  ForbiddenException, NotFoundException  } from '@nestjs/common';
import { CreateProdutoDto } from './dto/create-produto.dto.js';
import { UpdateProdutoDto } from './dto/update-produto.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { converterImagem, gravarImagem, removerArquivo } from '../imagens/arquivo-imagem.js';

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  async adicionarImagem(id: number, usuarioId: number, arquivo: Express.Multer.File | undefined) {
    const produto = await this.prisma.produtos.findUnique({ where: { id }, include: { lojas: true } });
    if (!produto) throw new NotFoundException('Produto não encontrado.');
    if (produto.lojas.usuario_id !== usuarioId) throw new ForbiddenException('Você não tem permissão para alterar este produto.');
    const conteudo = await converterImagem(arquivo);
    const imagem = await gravarImagem('produtos', id, conteudo);
    try {
      const ultima = await this.prisma.imagens_Produtos.aggregate({
        where: { produto_id: id }, _max: { ordem: true },
      });
      return await this.prisma.imagens_Produtos.create({
        data: { produto_id: id, url_imagem: imagem.url, ordem: (ultima._max.ordem ?? -1) + 1 },
      });
    } catch (erro) {
      await removerArquivo(imagem.caminho);
      throw erro;
    }
  }

  async create(
    usuarioId: number,
    createProdutoDto: CreateProdutoDto
  ) {
    const loja = await this.prisma.lojas.findFirst({
      where:{
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

  findAll() {
    return this.prisma.produtos.findMany({
      include: { imagem: { orderBy: { ordem: 'asc' } } },
    });
  }

  async findOne(id: number) {
    const produto = await this.prisma.produtos.findUnique({
      where: { id },
      include: { imagem: { orderBy: { ordem: 'asc' } } },
    });

    if(!produto){
      throw new NotFoundException(
        `Produto com ID ${id} não encontrado!`,
      );
    }

    return produto;
  }

  async update(id: number,  usuarioId: number, updateProdutoDto: UpdateProdutoDto) {
    const produto = await this.prisma.produtos.findUnique({
      where: { id },
      include: {
        lojas: true,
      }
    });

    if(!produto){
       throw new NotFoundException(
        `Produto com ID ${id} não encontrado!`,
      );
    }

    if(produto.lojas.usuario_id !== usuarioId){
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
      }
    });

    if(!produto){
      throw new NotFoundException(
       `Produto com ID ${id} não encontrado!`,
      );
    }

    if(produto.lojas.usuario_id !== usuario_id){
      throw new ForbiddenException(
        'Você não tem permissão para excluir este produto.',
      );
    }

    return this.prisma.produtos.delete({
        where: { id },
    });
  }
}
