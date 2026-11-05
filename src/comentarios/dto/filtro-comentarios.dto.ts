import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class FiltroComentariosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  avaliacao_loja_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  avaliacao_produto_id?: number;
}