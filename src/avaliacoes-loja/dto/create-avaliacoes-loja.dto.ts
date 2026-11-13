import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateAvaliacoesLojaDto {
  @IsInt({ message: 'O ID da loja deve ser um número inteiro.' })
  loja_id: number;

  @IsInt({ message: 'A nota deve ser um número inteiro.' })
  @Min(1, { message: 'A nota mínima é 1.' })
  @Max(5, { message: 'A nota máxima é 5.' })
  nota: number;

  @IsOptional()
  @IsString({ message: 'O comentário deve ser um texto.' })
  comentario?: string;
}