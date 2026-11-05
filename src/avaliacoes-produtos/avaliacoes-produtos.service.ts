import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAvaliacoesProdutoDto } from './dto/create-avaliacoes-produto.dto.js';
import { UpdateAvaliacoesProdutoDto } from './dto/update-avaliacoes-produto.dto.js';

@Injectable()
export class AvaliacoesProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usuarioId: number, dto: CreateAvaliacoesProdutoDto) {
    const produto = await this.prisma.produtos.findUnique({
      where: { id: dto.produto_id },
    });
    if (!produto) {
      throw new NotFoundException(
        `Produto com ID ${dto.produto_id} não encontrado!`,
      );
    }

    return this.prisma.avaliacoes_Produtos.create({
      data: { ...dto, usuario_id: usuarioId },
    });
  }

  findAll() {
    return this.prisma.avaliacoes_Produtos.findMany();
  }

  async findOne(id: number) {
    const avaliacao = await this.prisma.avaliacoes_Produtos.findUnique({
      where: { id },
    });
    if (!avaliacao) {
      throw new NotFoundException(`Avaliação com ID ${id} não encontrada!`);
    }
    return avaliacao;
  }

  async update(id: number, usuarioId: number, dto: UpdateAvaliacoesProdutoDto) {
    const avaliacao = await this.findOne(id);

    if (avaliacao.usuario_id !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar esta avaliação.',
      );
    }

    const { produto_id: _produtoId, ...dados } = dto;
    return this.prisma.avaliacoes_Produtos.update({
      where: { id },
      data: dados,
    });
  }

  async remove(id: number, usuarioId: number) {
    const avaliacao = await this.findOne(id);

    if (avaliacao.usuario_id !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para excluir esta avaliação.',
      );
    }

    return this.prisma.avaliacoes_Produtos.delete({ where: { id } });
  }
}