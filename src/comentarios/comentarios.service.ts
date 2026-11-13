import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateComentarioDto } from './dto/create-comentario.dto.js';
import { ForbiddenException } from '@nestjs/common';
import { UpdateComentarioDto } from './dto/update-comentario.dto.js';
import { FiltroComentariosDto } from './dto/filtro-comentarios.dto.js';

@Injectable()
export class ComentariosService {
    findAll(filtros: FiltroComentariosDto) {
        if (filtros.avaliacao_loja_id != null &&filtros.avaliacao_produto_id != null){
            throw new BadRequestException('Informe apenas um tipo de avaliação por consulta.');
        }
        return this.prisma.comentarios_Avaliacoes.findMany({
            where: {
                avaliacao_loja_id: filtros.avaliacao_loja_id,
                avaliacao_produto_id: filtros.avaliacao_produto_id,
            },
            orderBy: {
            createdAt: 'asc',
        },
        });
    }

    constructor(private readonly prisma: PrismaService) {}

    async create(usuarioId: number, dados: CreateComentarioDto) {
        const temLoja = dados.avaliacao_loja_id != null;
        const temProduto = dados.avaliacao_produto_id != null;
        const conteudo = dados.conteudo.trim();

        if(temLoja === temProduto) {
            throw new BadRequestException('Informe uma avaliação de loja ou produto, mas não ambas.');
        }
        if(!conteudo) {
            throw new BadRequestException('O conteúdo do comentário não pode ser vazio.');
        }
        if(dados.avaliacao_loja_id != null){
            const avaliacao = await this.prisma.avaliacoes_Loja.findUnique({
                where: { id: dados.avaliacao_loja_id }
            });
            if(!avaliacao) {
                throw new NotFoundException('Avaliação de loja não encontrada.');
            }
        }
        if(dados.avaliacao_produto_id != null){
            const avaliacao = await this.prisma.avaliacoes_Produtos.findUnique({
                where: { id: dados.avaliacao_produto_id }
            });
            if(!avaliacao) {
                throw new NotFoundException('Avaliação de produto não encontrada.');
            }
        }
        return await this.prisma.comentarios_Avaliacoes.create({
            data: {
                conteudo: conteudo,
                usuario_id: usuarioId,
                avaliacao_loja_id: dados.avaliacao_loja_id,
                avaliacao_produto_id: dados.avaliacao_produto_id
            }
        });
    }

    async findOne(id: number) {
        const comentario = await this.prisma.comentarios_Avaliacoes.findUnique({
            where: { id }
        });

        if (!comentario) {
            throw new NotFoundException(
            `Comentário com ID ${id} não encontrado.`
            );
        }

        return comentario;
    }

    async update(
        id: number,
        usuarioId: number,
        dados: UpdateComentarioDto
    ) {
        const comentario = await this.findOne(id);

        if (comentario.usuario_id !== usuarioId) {
            throw new ForbiddenException(
            'Você não tem permissão para editar este comentário.'
            );
        }

        const conteudo = dados.conteudo.trim();

        if (!conteudo) {
            throw new BadRequestException(
            'O comentário não pode estar vazio.'
            );
        }

        return this.prisma.comentarios_Avaliacoes.update({
            where: { id },
            data: { conteudo }
        });
    }

    async remove(id: number, usuarioId: number) {
        const comentario = await this.findOne(id);

        if (comentario.usuario_id !== usuarioId) {
            throw new ForbiddenException(
                'Você não tem permissão para excluir este comentário.'
            );
        }

        return this.prisma.comentarios_Avaliacoes.delete({
            where: { id }
        });
    }
}
