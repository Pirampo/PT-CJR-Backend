import { Injectable } from '@nestjs/common';
import { CreateProdutoDto } from './dto/create-produto.dto.js';
import { UpdateProdutoDto } from './dto/update-produto.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  create(createProdutoDto: CreateProdutoDto) {
    return this.prisma.produtos.create({
      data: createProdutoDto,
    });
  }

  findAll() {
    return this.prisma.produtos.findMany();
  }

  findOne(id: number) {
    return this.prisma.produtos.findUnique({
      where: { id },
    });
  }

  update(id: number, updateProdutoDto: UpdateProdutoDto) {
    return this.prisma.produtos.update({
      where: { id },
      data: updateProdutoDto,
    });
  }

  remove(id: number) {
    return this.prisma.produtos.delete({
      where: { id },
    });
  }
}
