import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

// impede que a rota seja acessada se haver algum campo incorreto
export class LoginRequestBody {
  @IsEmail({}, { message: 'O email fornecido é inválido.' })
  @IsNotEmpty({ message: 'O campo email não pode estar vazio.' })
  email: string;

  @IsString({ message: 'A senha deve ser uma string.' })
  @IsNotEmpty({ message: 'O campo senha não pode estar vazio.' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  senha: string;
}
