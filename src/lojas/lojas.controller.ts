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
import { Public } from '../auth/decorators/isPublic.decorator.js';
import type { UserPayload } from '../auth/types.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

const DEZ_MB = 10 * 1024 * 1024;
const DOIS_MB = 2 * 1024 * 1024;

// Recebe o arquivo em memória; o conteúdo real é validado no service.
function interceptarArquivo(campo: string, limite: number) {
  return FileInterceptor(campo, {
    storage: memoryStorage(),
    limits: { fileSize: limite, files: 1 },
  });
}

function validarArquivo(limite: number) {
  return new ParseFilePipeBuilder()
    .addMaxSizeValidator({ maxSize: limite })
    .build({
      fileIsRequired: true,
      errorHttpStatusCode: HttpStatus.BAD_REQUEST,
    });
}

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
  @UseInterceptors(interceptarArquivo('banner', DEZ_MB))
  adicionarBanner(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
    @UploadedFile(validarArquivo(DEZ_MB)) arquivo: Express.Multer.File,
  ) {
    return this.lojasService.adicionarBanner(id, user.sub, arquivo);
  }

  @Post(':id/imagens/foto-perfil')
  @UseInterceptors(interceptarArquivo('foto', DEZ_MB))
  adicionarFotoPerfil(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
    @UploadedFile(validarArquivo(DEZ_MB)) arquivo: Express.Multer.File,
  ) {
    return this.lojasService.adicionarFotoPerfil(id, user.sub, arquivo);
  }

  // Recebe SVG ou raster permitido, valida e publica somente a versão WebP.
  @Post(':id/imagens/logo')
  @UseInterceptors(interceptarArquivo('logo', DOIS_MB))
  adicionarLogo(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserPayload,
    @UploadedFile(validarArquivo(DOIS_MB)) arquivo: Express.Multer.File,
  ) {
    return this.lojasService.adicionarLogo(id, user.sub, arquivo);
  }

  // Visualização pública das lojas (sem login)
  @Public()
  @Get()
  findAll() {
    return this.lojasService.findAll();
  }

  @Public()
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
