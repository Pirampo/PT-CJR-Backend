import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateLojaDto } from './dto/create-loja.dto.js';
import { UpdateLojaDto } from './dto/update-loja.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { removerImagem } from '../imagens/remover-imagem.js';

@Injectable()
export class LojasService {
  constructor(private readonly prisma: PrismaService) {}
  create(createLojaDto: CreateLojaDto) {
    return this.prisma.lojas.create({
      data: createLojaDto,
    });
  }
  async findByUser(userId: number) {
    // sem lojas, devolve uma lista vazia: a tela decide o que mostrar
    return this.prisma.lojas.findMany({
      where: { usuario_id: userId },
    });
  }

  findAll() {
    return this.prisma.lojas.findMany();
  }

  async findOne(id: number) {
    const loja = await this.prisma.lojas.findUnique({
      where: { id },
    });

    if (!loja) {
      throw new NotFoundException(`Loja com ID ${id} não encontrada!`);
    }

    return loja;
  }

  async update(id: number, usuarioId: number, updateLojaDto: UpdateLojaDto) {
    // verifica se o usuario cadastrou a loja
    const loja = await this.prisma.lojas.findFirst({
      where: {
        id,
        usuario_id: usuarioId,
      },
    });
    if (!loja) {
      throw new NotFoundException(
        'Esta loja não foi cadastrada por este usuário.',
      );
    }

    // verifica se o nome passado é o mesmo nome de outra loja
    if (updateLojaDto.nome && updateLojaDto.nome !== loja.nome) {
      const outraLojaComMesmoNome = await this.prisma.lojas.findUnique({
        where: { nome: updateLojaDto.nome },
      });
      if (outraLojaComMesmoNome) {
        throw new ConflictException('Nome da loja já está sendo usado.');
      }
    }
    // se passar em todos os teste, atualize:
    const { usuario_id: _usuarioId, ...dados } = updateLojaDto;
    return this.prisma.lojas.update({
      where: { id },
      data: {
        ...dados,
      },
      select: {
        id: true,
        nome: true,
      },
    });
  }

  async atualizarLogo(
    id: number,
    usuarioId: number,
    file: { buffer: Buffer; mimetype: string },
  ) {
    // só o dono da loja pode trocar a imagem
    const loja = await this.prisma.lojas.findFirst({
      where: {
        id,
        usuario_id: usuarioId,
      },
    });

    if (!loja) {
      throw new NotFoundException(
        'Esta loja não foi cadastrada por este usuário.',
      );
    }

    const extensao = file.mimetype.split('/')[1];
    const nomeArquivo = `${randomUUID()}.${extensao}`;

    const pasta = join(process.cwd(), 'uploads', 'lojas');
    await mkdir(pasta, { recursive: true });
    await writeFile(join(pasta, nomeArquivo), file.buffer);

    const atualizada = await this.prisma.lojas.update({
      where: { id },
      data: { logo_url: `/uploads/lojas/${nomeArquivo}` },
      select: { id: true, logo_url: true },
    });

    // apaga a imagem antiga, se nenhuma outra loja estiver usando
    const emUso = await this.prisma.lojas.count({
      where: { logo_url: loja.logo_url },
    });
    if (emUso === 0) {
      await removerImagem('lojas', loja.logo_url);
    }

    return atualizada;
  }

  async remove(id: number, usuarioId: number) {
    const loja = await this.prisma.lojas.findFirst({
      where: {
        id,
        usuario_id: usuarioId,
      },
    });

    if (!loja) {
      throw new NotFoundException(
        'Esta loja não foi cadastrada por este usuário.',
      );
    }

    return await this.prisma.lojas.delete({
      where: { id },
      select: {
        id: true,
        usuario_id: true,
        nome: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
