import {
  autorPublico,
  type AutorAvaliacao,
} from '../avaliacoes/autor-publico.js';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAvaliacoesProdutoDto } from './dto/create-avaliacoes-produto.dto.js';
import { UpdateAvaliacoesProdutoDto } from './dto/update-avaliacoes-produto.dto.js';

// Filtros opcionais da listagem (vêm da query string, ex.: ?produto_id=1)
export interface FiltroAvaliacoesProdutos {
  produto_id?: number;
  usuario_id?: number;
}

// Dados do autor que acompanham cada avaliação, para as telas mostrarem nome e foto.
// Nunca inclui email nem senha.
// No schema, a relação com o usuário em Avaliacoes_Produtos se chama "avaliacao_produto".
const AUTOR = {
  avaliacao_produto: {
    select: { id: true, nome: true, username: true, foto_perfil_url: true },
  },
} as const;

// Devolve o autor no campo "usuario", igual às avaliações de loja,
// em vez do nome confuso que a relação tem no schema.
function comAutor<
  Autor extends AutorAvaliacao,
  Avaliacao extends { avaliacao_produto: Autor },
>({ avaliacao_produto, ...avaliacao }: Avaliacao) {
  return { ...avaliacao, usuario: autorPublico(avaliacao_produto) };
}

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

    const avaliacao = await this.prisma.avaliacoes_Produtos.create({
      data: {
        produto_id: dto.produto_id,
        nota: dto.nota,
        comentario: dto.comentario,
        usuario_id: usuarioId, // sempre o usuário do token, nunca o que vier no corpo
      },
      include: AUTOR,
    });
    return comAutor(avaliacao);
  }

  // Sem filtro devolve todas. Com produto_id, só as daquele produto; com usuario_id, só as daquele autor.
  // As mais recentes vêm primeiro.
  async findAll(filtros: FiltroAvaliacoesProdutos = {}) {
    const avaliacoes = await this.prisma.avaliacoes_Produtos.findMany({
      where: {
        produto_id: filtros.produto_id,
        usuario_id: filtros.usuario_id,
      },
      include: AUTOR,
      orderBy: { createdAt: 'desc' },
    });
    return avaliacoes.map(comAutor);
  }

  async findOne(id: number) {
    const avaliacao = await this.prisma.avaliacoes_Produtos.findUnique({
      where: { id },
      include: AUTOR,
    });
    if (!avaliacao) {
      throw new NotFoundException(`Avaliação com ID ${id} não encontrada!`);
    }
    return comAutor(avaliacao);
  }

  async update(id: number, usuarioId: number, dto: UpdateAvaliacoesProdutoDto) {
    const avaliacao = await this.findOne(id);

    if (avaliacao.usuario_id !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar esta avaliação.',
      );
    }

    // produto_id não entra: uma avaliação não muda de produto
    const atualizada = await this.prisma.avaliacoes_Produtos.update({
      where: { id },
      data: { nota: dto.nota, comentario: dto.comentario },
      include: AUTOR,
    });
    return comAutor(atualizada);
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
