import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class TrocarSenhaDto {
  @IsEmail({}, { message: 'O email fornecido é inválido.' })
  email: string;

  @IsString({ message: 'A senha atual deve ser uma string.' })
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  senha_atual: string;

  @IsString({ message: 'A nova senha deve ser uma string.' })
  @MinLength(6, { message: 'A nova senha deve ter no mínimo 6 caracteres.' })
  nova_senha: string;
}
