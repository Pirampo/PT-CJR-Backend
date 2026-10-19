import { Injectable } from '@nestjs/common';
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
      where: {id},
    });
  }

  update(id: number, updateLojaDto: UpdateLojaDto) {
    return this.prisma.lojas.update({
      where: {id},
      data: updateLojaDto,
    });
  }

  remove(id: number) {
    return this.prisma.lojas.delete({
      where: {id},
    });
  }
}
