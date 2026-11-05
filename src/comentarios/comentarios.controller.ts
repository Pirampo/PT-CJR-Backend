import { Controller, Get, Post, Body, Param, ParseIntPipe, Patch, Delete, Query } from '@nestjs/common';
import { ComentariosService } from './comentarios.service.js';
import { Public } from '../auth/decorators/isPublic.decorator.js';
import { CreateComentarioDto } from './dto/create-comentario.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { UserPayload } from '../auth/types.js';
import { UpdateComentarioDto } from './dto/update-comentario.dto.js';
import { FiltroComentariosDto } from './dto/filtro-comentarios.dto.js';

@Controller('comentarios')
export class ComentariosController {
    constructor(private readonly comentariosService: ComentariosService) {}

    @Public()
    @Get()
    findAll(@Query() filtros: FiltroComentariosDto) {
    return this.comentariosService.findAll(filtros);
    }

    @Post()
    create(@Body() createComentarioDto: CreateComentarioDto, @CurrentUser() usuario: UserPayload) {
        return this.comentariosService.create(usuario.sub, createComentarioDto); 
    }

    @Public()
    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
    return this.comentariosService.findOne(id);
    }

    @Patch(':id')
    update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') usuarioId: number,
    @Body() dados: UpdateComentarioDto
    ) {
        return this.comentariosService.update(id, usuarioId, dados);
    }

    @Delete(':id')
    remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') usuarioId: number
    ) {
    return this.comentariosService.remove(id, usuarioId);
    }
}
