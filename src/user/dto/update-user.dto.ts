import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto.js';

// essa forma de chamar a funcao permite o usuário não precise preencher todos os campos obrigatórios
// apenas a alteração de uma informação (devidamente alterada) será aceita
export class UpdateUserDto extends PartialType(CreateUserDto) {}
