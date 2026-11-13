import { PartialType } from '@nestjs/mapped-types';
import { CreateAvaliacoesProdutoDto } from './create-avaliacoes-produto.dto.js';

export class UpdateAvaliacoesProdutoDto extends PartialType(CreateAvaliacoesProdutoDto) {}
