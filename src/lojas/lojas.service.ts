import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateLojaDto } from './dto/create-loja.dto.js';
import { UpdateLojaDto } from './dto/update-loja.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LojasService {
  constructor(private readonly prisma: PrismaService) {}
  create(createLojaDto: CreateLojaDto) {
    return this.prisma.lojas.create({
      data: createLojaDto,
    });
  }

  findAll() {
    return this.prisma.lojas.findMany();
  }

  findOne(id: number) {
    return this.prisma.lojas.findUnique({
      where: { id },
    });
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

  async remove(id: number) {
    const id_loja = await this.prisma.lojas.findUnique({
      where: { id },
      select: {
        id: true,
        usuario_id: true,
        nome: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!id_loja) {
      throw new NotFoundException(
        'ID da loja não encontrado para este usuário!',
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
  /*
  remove(id: number) {
    return this.prisma.lojas.delete({
      where: { id },
    });
  }*/
}
