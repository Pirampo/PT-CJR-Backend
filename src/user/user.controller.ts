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
} from '@nestjs/common';
import { UserService } from './user.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { Public } from '../auth/decorators/isPublic.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public() // como o auth.guard protege todas as rotas esperando um token valido, a rota de criacao de usuario deve ser publica
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  // impede que seja passado os id's dos usuarios cadastradados usando GET /user ou GET /user/2
  // assim retorna apenas os dados do próprio usuário, com excção da senha
  // as proximas rotas nao recebem o decorator Public, pois precisam da autorizacao do auth.guard
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
