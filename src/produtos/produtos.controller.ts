import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { LIMITE_FOTO } from '../imagens/arquivo-imagem.js';
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

  @Post(':id/imagens')
  @UseInterceptors(FileInterceptor('imagem', {
    storage: memoryStorage(), limits: { fileSize: LIMITE_FOTO, files: 1 },
  }))
  adicionarImagem(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: UserPayload,
    @UploadedFile() arquivo: Express.Multer.File,
  ) {
    return this.produtosService.adicionarImagem(id, usuario.sub, arquivo);
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

