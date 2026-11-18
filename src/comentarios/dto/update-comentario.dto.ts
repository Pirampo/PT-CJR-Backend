import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateComentarioDto {
  @IsString()
  @IsNotEmpty()
  conteudo: string;
}