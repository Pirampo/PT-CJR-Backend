import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateCategoriaDto {
  @IsString()
  nome: string;

  @IsOptional()
  @IsInt()
  categoria_pai_id?: number;
}