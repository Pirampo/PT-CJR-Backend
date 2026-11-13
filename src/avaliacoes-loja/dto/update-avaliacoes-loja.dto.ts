import { PartialType } from '@nestjs/mapped-types';
import { CreateAvaliacoesLojaDto } from './create-avaliacoes-loja.dto.js';

export class UpdateAvaliacoesLojaDto extends PartialType(CreateAvaliacoesLojaDto) {}
