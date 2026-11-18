import {
    IsString,
    IsNotEmpty,
    IsInt,
    IsOptional,
} from 'class-validator';

export class CreateComentarioDto {
    @IsString()
    @IsNotEmpty()
    conteudo: string;

    @IsInt()
    @IsOptional()
    avaliacao_loja_id?: number;

    @IsInt()
    @IsOptional()
    avaliacao_produto_id?: number;
}