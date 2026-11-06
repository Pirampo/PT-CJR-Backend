import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { AvaliacoesProdutosService } from './avaliacoes-produtos.service.js';
import { CreateAvaliacoesProdutoDto } from './dto/create-avaliacoes-produto.dto.js';
import { UpdateAvaliacoesProdutoDto } from './dto/update-avaliacoes-produto.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/isPublic.decorator.js';
import type { UserPayload } from '../auth/types.js';

@Controller('avaliacoes-produtos')
export class AvaliacoesProdutosController {
  constructor(
    private readonly avaliacoesProdutosService: AvaliacoesProdutosService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateAvaliacoesProdutoDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.avaliacoesProdutosService.create(user.sub, dto);
  }

  @Public()
  @Get()
  findAll() {
    return this.avaliacoesProdutosService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.avaliacoesProdutosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAvaliacoesProdutoDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.avaliacoesProdutosService.update(id, user.sub, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
  ) {
    return this.avaliacoesProdutosService.remove(id, user.sub);
  }
}