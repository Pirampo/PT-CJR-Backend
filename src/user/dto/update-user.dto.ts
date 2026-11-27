import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateUserDto } from './create-user.dto.js';

// essa forma de chamar a funcao permite o usuário não precise preencher todos os campos obrigatórios
// apenas a alteração de uma informação (devidamente alterada) será aceita
export class UpdateUserDto extends PartialType(CreateUserDto) {
  // obrigatória apenas quando a senha for alterada (conferida no UserService)
  @IsOptional()
  @IsString({ message: 'A senha antiga deve ser uma string.' })
  senha_antiga?: string;
}
