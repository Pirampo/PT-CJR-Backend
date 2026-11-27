import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAvaliacoesLojaDto } from './create-avaliacoes-loja.dto.js';
import { CreateAvaliacoesProdutoDto } from '../../avaliacoes-produtos/dto/create-avaliacoes-produto.dto.js';

const erros = (nota: number) => [
  ...validateSync(
    plainToInstance(CreateAvaliacoesLojaDto, { loja_id: 1, nota }),
  ),
  ...validateSync(
    plainToInstance(CreateAvaliacoesProdutoDto, { produto_id: 1, nota }),
  ),
];

describe('nota das avaliações de loja e de produto', () => {
  it('aceita notas inteiras de 0 a 5', () => {
    for (const nota of [0, 3, 5]) expect(erros(nota)).toHaveLength(0);
  });

  it('recusa notas fora de 0 a 5 ou fracionadas', () => {
    for (const nota of [-1, 6, 2.5]) expect(erros(nota)).toHaveLength(2);
  });
});
