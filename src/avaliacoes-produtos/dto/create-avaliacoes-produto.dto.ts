import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateAvaliacoesProdutoDto {
  @IsInt({ message: 'O ID do produto deve ser um número inteiro.' })
  produto_id: number;

  @IsInt({ message: 'A nota deve ser um número inteiro.' })
  @Min(1, { message: 'A nota mínima é 1.' })
  @Max(5, { message: 'A nota máxima é 5.' })
  nota: number;

  @IsOptional()
  @IsString({ message: 'O comentário deve ser um texto.' })
  comentario?: string;
}