import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProdutoDto {
  @IsInt({ message: 'O ID da loja deve ser um número inteiro.' })
  loja_id: number;

  @IsInt({ message: 'O ID da categoria deve ser um número inteiro.' })
  categoria_id: number;

  @IsString({ message: 'O nome do produto deve ser um texto.' })
  @IsNotEmpty({ message: 'O nome do produto é obrigatório.' })
  nome: string;

  @IsOptional()
  @IsString({ message: 'A descrição deve ser um texto.' })
  descricao?: string;

  @IsNumber({ maxDecimalPlaces: 2 },{ message: 'O preço deve ser um número com no máximo 2 casas decimais.' },

  )
  @Min(0,{ message: 'O preço não pode ser negativo.' })
  preco: number;

  @IsOptional()
  @IsInt({ message: 'O estoque deve ser um número inteiro.' })
  @Min(0, { message: 'O estoque não pode ser negativo.' })
  estoque?: number;
}

