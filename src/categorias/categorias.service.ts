import { Injectable } from '@nestjs/common';
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

  findOne(id: number) {
    return this.prisma.categorias.findUnique({
      where: {id}, 
    });
  }

  update(id: number, updateCategoriaDto: UpdateCategoriaDto) {
    return this.prisma.categorias.update({
      where: {id},
      data: updateCategoriaDto,
    });
  }

  remove(id: number) {
    return this.prisma.categorias.delete({
        where: {id},
    });
  }
}
