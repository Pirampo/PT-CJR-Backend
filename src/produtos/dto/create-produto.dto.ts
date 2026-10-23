import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProdutoDto {
  @IsInt()
  loja_id: number;

  @IsInt()
  categoria_id: number;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  preco: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estoque?: number;
}

