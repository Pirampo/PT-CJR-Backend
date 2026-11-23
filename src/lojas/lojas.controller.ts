import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LojasService } from './lojas.service.js';
import { CreateLojaDto } from './dto/create-loja.dto.js';
import { UpdateLojaDto } from './dto/update-loja.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { UserPayload } from '../auth/types.js';

@Controller('lojas')
export class LojasController {
  constructor(private readonly lojasService: LojasService) {}

  @Post()
  create(@Body() createLojaDto: CreateLojaDto) {
    return this.lojasService.create(createLojaDto);
  }

  @Get()
  findAll() {
    return this.lojasService.findAll();
  }
  @Get('me')
  findMine(@CurrentUser() user: UserPayload) {
    return this.lojasService.findByUser(user.sub);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lojasService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLojaDto: UpdateLojaDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.lojasService.update(id, user.sub, updateLojaDto);
  }

  @Post(':id/imagens/logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (req, file, callback) => {
        const permitidos = ['image/jpeg', 'image/png', 'image/webp'];

        if (!permitidos.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Formato de imagem não permitido.'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  atualizarLogo(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
    @UploadedFile() file: { buffer: Buffer; mimetype: string },
  ) {
    if (!file) {
      throw new BadRequestException('Envie uma imagem.');
    }

    return this.lojasService.atualizarLogo(id, user.sub, file);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
  ) {
    return this.lojasService.remove(id, user.sub);
  }
}
