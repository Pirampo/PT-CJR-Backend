import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAvaliacoesLojaDto } from './dto/create-avaliacoes-loja.dto.js';
import { UpdateAvaliacoesLojaDto } from './dto/update-avaliacoes-loja.dto.js';

// Filtros opcionais da listagem (vêm da query string, ex.: ?loja_id=1)
export interface FiltroAvaliacoesLoja {
  loja_id?: number;
  usuario_id?: number;
}

// Dados do autor que acompanham cada avaliação, para as telas mostrarem nome e foto.
// Nunca inclui email nem senha.
const AUTOR = {
  select: { id: true, nome: true, username: true, foto_perfil_url: true },
} as const;

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
      data: {
        loja_id: dto.loja_id,
        nota: dto.nota,
        comentario: dto.comentario,
        usuario_id: usuarioId, // sempre o usuário do token, nunca o que vier no corpo
      },
      include: { usuario: AUTOR },
    });
  }

  // Sem filtro devolve todas. Com loja_id, só as daquela loja; com usuario_id, só as daquele autor.
  // As mais recentes vêm primeiro.
  findAll(filtros: FiltroAvaliacoesLoja = {}) {
    return this.prisma.avaliacoes_Loja.findMany({
      where: {
        loja_id: filtros.loja_id,
        usuario_id: filtros.usuario_id,
      },
      include: { usuario: AUTOR },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const avaliacao = await this.prisma.avaliacoes_Loja.findUnique({
      where: { id },
      include: { usuario: AUTOR },
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

    // loja_id não entra: uma avaliação não muda de loja
    return this.prisma.avaliacoes_Loja.update({
      where: { id },
      data: { nota: dto.nota, comentario: dto.comentario },
      include: { usuario: AUTOR },
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
