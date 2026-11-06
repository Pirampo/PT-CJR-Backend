import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAvaliacoesLojaDto } from './dto/create-avaliacoes-loja.dto.js';
import { UpdateAvaliacoesLojaDto } from './dto/update-avaliacoes-loja.dto.js';

@Injectable()
export class AvaliacoesLojaService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usuarioId: number, dto: CreateAvaliacoesLojaDto) {
    const loja = await this.prisma.lojas.findUnique({
      where: { id: dto.loja_id },
    });
    if (!loja) {
      throw new NotFoundException(`Loja com ID ${dto.loja_id} não encontrada!`);
    }

    return this.prisma.avaliacoes_Loja.create({
      data: { ...dto, usuario_id: usuarioId },
    });
  }

  findAll() {
    return this.prisma.avaliacoes_Loja.findMany();
  }

  async findOne(id: number) {
    const avaliacao = await this.prisma.avaliacoes_Loja.findUnique({
      where: { id },
    });
    if (!avaliacao) {
      throw new NotFoundException(`Avaliação com ID ${id} não encontrada!`);
    }
    return avaliacao;
  }

  async update(id: number, usuarioId: number, dto: UpdateAvaliacoesLojaDto) {
    const avaliacao = await this.findOne(id);

    if (avaliacao.usuario_id !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar esta avaliação.',
      );
    }

    const { loja_id: _lojaId, ...dados } = dto;
    return this.prisma.avaliacoes_Loja.update({
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

    return this.prisma.avaliacoes_Loja.delete({ where: { id } });
  }
}