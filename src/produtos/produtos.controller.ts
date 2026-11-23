import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  LIMITE_FOTO,
  LIMITE_IMAGEM_PRODUTO,
} from '../imagens/arquivo-imagem.js';
import { ProdutosService } from './produtos.service.js';
import { CreateProdutoDto } from './dto/create-produto.dto.js';
import { UpdateProdutoDto } from './dto/update-produto.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/isPublic.decorator.js';
import type { UserPayload } from '../auth/types.js';
import { BadRequestException } from '@nestjs/common';

@Controller('produtos')
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Post()
  create(
    @Body() createProdutoDto: CreateProdutoDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.produtosService.create(user.sub, createProdutoDto);
  }

  @Get('me')
  findMine(@CurrentUser() user: UserPayload) {
    return this.produtosService.findByUser(user.sub);
  }

  @Post(':id/imagens')
  @UseInterceptors(
    FileInterceptor('imagem', {
      storage: memoryStorage(),
      limits: { fileSize: LIMITE_FOTO, files: 1 },
    }),
  )
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
  @Get(':id/imagens')
  listarImagens(@Param('id', ParseIntPipe) id: number) {
    return this.produtosService.listarImagens(id);
  }

  @Public()
  @Get(':id/imagens/:imagemId')
  buscarImagem(
    @Param('id', ParseIntPipe) id: number,
    @Param('imagemId', ParseIntPipe) imagemId: number,
  ) {
    return this.produtosService.buscarImagem(id, imagemId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.produtosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProdutoDto: UpdateProdutoDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.produtosService.update(id, user.sub, updateProdutoDto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
  ) {
    return this.produtosService.remove(id, user.sub);
  }

  @Post(':id/imagem')
  @UseInterceptors(
    FileInterceptor('imagem', {
      storage: memoryStorage(),
      limits: { fileSize: LIMITE_IMAGEM_PRODUTO, files: 1 },
    }),
  )
  uploadImagem(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile()
    file: Express.Multer.File,
    @CurrentUser() user: UserPayload,
  ) {
    if (!file) {
      throw new BadRequestException('Envie uma imagem.');
    }

    return this.produtosService.uploadImagem(id, user.sub, file);
  }

  @Patch(':id/imagens/:imagemId')
  @UseInterceptors(
    FileInterceptor('imagem', {
      storage: memoryStorage(),
      limits: { fileSize: LIMITE_IMAGEM_PRODUTO, files: 1 },
    }),
  )
  substituirImagem(
    @Param('id', ParseIntPipe) id: number,
    @Param('imagemId', ParseIntPipe) imagemId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserPayload,
  ) {
    if (!file) {
      throw new BadRequestException('Envie uma imagem.');
    }

    return this.produtosService.substituirImagem(id, imagemId, user.sub, file);
  }

  @Delete(':id/imagens/:imagemId')
  removerImagem(
    @Param('id', ParseIntPipe) id: number,
    @Param('imagemId', ParseIntPipe) imagemId: number,
    @CurrentUser() user: UserPayload,
  ) {
    return this.produtosService.removerImagem(id, imagemId, user.sub);
  }
}
