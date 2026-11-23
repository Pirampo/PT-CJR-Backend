import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

// Apaga do disco uma imagem que foi substituída.
// Só aceita caminhos no formato /uploads/<pasta>/<arquivo>, para nunca apagar
// um arquivo de fora dessa pasta.
export async function removerImagem(
  pasta: 'usuarios' | 'lojas',
  url: string | null,
) {
  const formato = new RegExp(`^/uploads/${pasta}/([\\w-]+\\.\\w+)$`);
  const nomeArquivo = url?.match(formato)?.[1];

  if (!nomeArquivo) return;

  try {
    await unlink(join(process.cwd(), 'uploads', pasta, nomeArquivo));
  } catch (erro) {
    // a imagem nova já foi salva, então uma falha aqui não cancela a troca
    console.error('Não foi possível apagar a imagem antiga:', erro);
  }
}
