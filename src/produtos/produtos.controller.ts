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
import { ProdutosService } from './produtos.service.js';
import { CreateProdutoDto } from './dto/create-produto.dto.js';
import { UpdateProdutoDto } from './dto/update-produto.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/isPublic.decorator.js';
import type { UserPayload } from '../auth/types.js';
import {
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

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

  @Public()
  @Get()
  findAll() {
    return this.produtosService.findAll();
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
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB
      },
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
  uploadImagem(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile()
    file: {
      buffer: Buffer;
      mimetype: string;
    },
    @CurrentUser() user: UserPayload,
  ) {
    if (!file) {
      throw new BadRequestException('Envie uma imagem.');
    }

    return this.produtosService.uploadImagem(id, user.sub, file);
  }
}
