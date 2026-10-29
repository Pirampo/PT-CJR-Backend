import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoriaDto {
  @IsString({ message: 'O nome da categoria deve ser um texto.' })
  @IsNotEmpty({ message: 'O nome da categoria é obrigatório.' })
  nome: string;

  @IsOptional()
  @IsInt({ message: 'O ID da categoria pai deve ser um número inteiro.' })
  categoria_pai_id?: number;
}