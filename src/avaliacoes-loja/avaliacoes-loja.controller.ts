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
import { AvaliacoesLojaService } from './avaliacoes-loja.service.js';
import { CreateAvaliacoesLojaDto } from './dto/create-avaliacoes-loja.dto.js';
import { UpdateAvaliacoesLojaDto } from './dto/update-avaliacoes-loja.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/isPublic.decorator.js';
import type { UserPayload } from '../auth/types.js';

@Controller('avaliacoes-loja')
export class AvaliacoesLojaController {
  constructor(private readonly avaliacoesLojaService: AvaliacoesLojaService) {}

  @Post()
  create(
    @Body() dto: CreateAvaliacoesLojaDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.avaliacoesLojaService.create(user.sub, dto);
  }

  @Public()
  @Get()
  findAll() {
    return this.avaliacoesLojaService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.avaliacoesLojaService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAvaliacoesLojaDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.avaliacoesLojaService.update(id, user.sub, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
  ) {
    return this.avaliacoesLojaService.remove(id, user.sub);
  }
}