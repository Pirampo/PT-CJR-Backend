import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ProdutosService } from './produtos.service.js';
import { CreateProdutoDto } from './dto/create-produto.dto.js';
import { UpdateProdutoDto } from './dto/update-produto.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/isPublic.decorator.js';
import type { UserPayload } from '../auth/types.js';


@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Post()
  create(
    @Body() createProdutoDto: CreateProdutoDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.produtosService.create(user.sub,createProdutoDto);
  }

  @Public()
  @Get()
  findAll() {
    return this.produtosService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id',ParseIntPipe) id: number) {
    return this.produtosService.findOne(id);
  }

  @Patch(':id')
  update( 
    @Param('id',ParseIntPipe) id: number, 
    @Body() updateProdutoDto: UpdateProdutoDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.produtosService.update(id, user.sub, updateProdutoDto);
  }

  @Delete(':id')
  remove(
    @Param('id',ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
) {
    return this.produtosService.remove(id,user.sub);
  }
}
  