import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// faz a leitura e avaliação dos dados recebidos da requisição a partir do ValidationPipe
// será aceita a requisição apenas se todos os campos obrigatórios forem devidamente preenchidos





export class CreateUserDto {
  @IsEmail({}, { message: 'O email fornecido é inválido.' })
  @IsNotEmpty({ message: 'O campo email não pode estar vazio.' })
  email: string;

  @IsString({ message: 'A senha deve ser uma string.' })
  @IsNotEmpty({ message: 'O campo senha não pode estar vazio.' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  senha: string;

  @IsString({ message: 'O nome deve ser uma string.' })
  @IsNotEmpty({ message: 'O campo nome não pode estar vazio.' })
  nome: string;

  @IsString({ message: 'O username deve ser uma string.' })
  @IsNotEmpty({ message: 'O campo de username deve ser preenchido.' })
  username: string;

  @IsOptional()
  @IsString()
  foto_perfil_url?: string;
}
