import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
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

  // GET /avaliacoes-loja              -> todas
  // GET /avaliacoes-loja?loja_id=1    -> só as da loja 1
  // GET /avaliacoes-loja?usuario_id=2 -> só as escritas pelo usuário 2
  @Public()
  @Get()
  findAll(
    @Query('loja_id', new ParseIntPipe({ optional: true })) lojaId?: number,
    @Query('usuario_id', new ParseIntPipe({ optional: true }))
    usuarioId?: number,
  ) {
    return this.avaliacoesLojaService.findAll({
      loja_id: lojaId,
      usuario_id: usuarioId,
    });
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
