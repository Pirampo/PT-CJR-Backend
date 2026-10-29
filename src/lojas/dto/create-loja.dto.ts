import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLojaDto {
  @IsInt({ message: 'O ID do usuário deve ser um número inteiro.' })
  usuario_id: number;

  @IsString({ message: 'O nome da loja deve ser um texto.' })
  @IsNotEmpty({ message: 'O nome da loja é obrigatório.' })
  nome: string;

  @IsOptional()
  @IsString({ message: 'A descrição deve ser um texto.'})
  descricao?: string;

  @IsOptional()
  @IsString({ message: 'A URL do logo deve ser um texto.' })
  logo_url?: string;

  @IsOptional()
  @IsString({ message: 'A URL do banner deve ser um texto.' })
  banner_url?: string;

  @IsOptional()
  @IsString({ message: 'A URL do sticker deve ser um texto.' })
  sticker_url?: string;
}