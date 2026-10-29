import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCategoriaDto } from './dto/create-categoria.dto.js';
import { UpdateCategoriaDto } from './dto/update-categoria.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CategoriasService {
  constructor(private readonly prisma: PrismaService) {}

  create(createCategoriaDto: CreateCategoriaDto) {
    return this.prisma.categorias.create({
      data: createCategoriaDto,
    });
  }

  findAll() {
    return this.prisma.categorias.findMany();
  }

  async findOne(id: number) {
    const categoria = await this.prisma.categorias.findUnique({
      where: { id },
    });

    if (!categoria) {
      throw new NotFoundException(
        `Categoria com ID ${id} não encontrada!`,
      );
    }

    return categoria;
  }

  async update(id: number, updateCategoriaDto: UpdateCategoriaDto) {
    const categoria = await this.prisma.categorias.findUnique({
      where: { id },
    });

    if (!categoria) {
      throw new NotFoundException(
        `Categoria com ID ${id} não encontrada!`,
      );
    }

    return this.prisma.categorias.update({
      where: { id },
      data: updateCategoriaDto,
    });
  }

  async remove(id: number) {
    const categoria = await this.prisma.categorias.findUnique({
      where: { id },
    });

    if (!categoria) {
      throw new NotFoundException(
        `Categoria com ID ${id} não encontrada!`,
      );
    }

    return await this.prisma.categorias.delete({
      where: { id },
    });
  }
}