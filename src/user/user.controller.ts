import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ForbiddenException,
  ParseIntPipe,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Public } from '../auth/decorators/isPublic.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get('me')
  findMe(@CurrentUser('sub') currentUserId: number) {
    return this.userService.findOne(currentUserId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') currentUserId: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    if (id !== currentUserId) {
      throw new ForbiddenException(
        'Voce não tem permisão para alterar este usuário.',
      );
    }
    return this.userService.update(id, updateUserDto);
  }

  @Post(':id/foto-perfil')
  @UseInterceptors(
    FileInterceptor('foto', {
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
  atualizarFoto(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') currentUserId: number,
    @UploadedFile() file: { buffer: Buffer; mimetype: string },
  ) {
    if (id !== currentUserId) {
      throw new ForbiddenException('Você só pode alterar a sua própria foto.');
    }

    if (!file) {
      throw new BadRequestException('Envie uma imagem.');
    }

    return this.userService.atualizarFoto(id, file);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') currentUserId: number,
  ) {
    if (id !== currentUserId) {
      throw new ForbiddenException(
        'Você nao tem permissão para excluir este usuário.',
      );
    }
    return this.userService.remove(id);
  }
}
