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
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { LojasService } from './lojas.service.js';
import { CreateLojaDto } from './dto/create-loja.dto.js';
import { UpdateLojaDto } from './dto/update-loja.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { UserPayload } from '../auth/types.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('lojas')
export class LojasController {
  constructor(private readonly lojasService: LojasService) { }

  @Post()
  create(
    @Body() createLojaDto: CreateLojaDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.lojasService.create(createLojaDto, user.sub);
  }


  @Post(':id/imagens/banner')
  @UseInterceptors(
    FileInterceptor('banner', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  adicionarBanner(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: 10 * 1024 * 1024,
        })
        .build({
          fileIsRequired: true,
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        }),
    )
    arquivo: Express.Multer.File,
  ) {
    return this.lojasService.adicionarBanner(
      id,
      user.sub,
      arquivo,
    );
  }


  @Get()
  findAll() {
    return this.lojasService.findAll();
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

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
  ) {
    return this.lojasService.remove(id, user.sub);
  }
}
