import 'dotenv/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { UserService } from '../dist/user/user.service.js';
import { ProdutosService } from '../dist/produtos/produtos.service.js';
import { AvaliacoesLojaService } from '../dist/avaliacoes-loja/avaliacoes-loja.service.js';
import { converterImagem } from '../dist/imagens/arquivo-imagem.js';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const dadosDir = join(raiz, 'prisma', 'demo');
export const MARCA = '\n[stockio-demo-seed:v1]\n';
export class DemoError extends Error {}
const falhar = (mensagem) => {
  throw new DemoError(mensagem);
};
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');

function destino(url, rotulo) {
  let banco;
  try {
    banco = new URL(url);
  } catch {
    falhar(`${rotulo} deve ser uma URL PostgreSQL válida.`);
  }
  if (!['postgres:', 'postgresql:'].includes(banco.protocol))
    falhar(`${rotulo}: protocolo inválido.`);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(banco.hostname);
  const nome = decodeURIComponent(banco.pathname.slice(1));
  if (
    !local ||
    !/^[a-zA-Z0-9_-]+$/.test(nome) ||
    ['postgres', 'template0', 'template1'].includes(nome)
  ) {
    falhar(
      `${rotulo} deve apontar para um banco local de demonstração, fora dos bancos de sistema.`,
    );
  }
  for (const [chave, valor] of banco.searchParams) {
    if (chave !== 'schema' || valor !== 'public')
      falhar(`${rotulo}: somente schema=public é permitido nos parâmetros.`);
  }
  return {
    url: banco.href,
    nome,
    porta: banco.port || '5432',
    identidade: `${banco.port || '5432'}/${nome}`,
  };
}

export function configurarDemo(env = process.env) {
  if (
    !['development', 'test', undefined, ''].includes(env.NODE_ENV) ||
    env.APP_ENV === 'production' ||
    env.VERCEL_ENV === 'production'
  ) {
    falhar('O seed de demonstração é proibido em produção.');
  }
  const banco = destino(env.DEMO_DATABASE_URL, 'DEMO_DATABASE_URL');
  if (env.DEMO_DATABASE_CONFIRM !== banco.nome)
    falhar(
      'Defina DEMO_DATABASE_CONFIRM com o nome exato do banco de destino.',
    );
  if (env.DATABASE_URL) {
    let atual;
    try {
      atual = new URL(env.DATABASE_URL);
    } catch {
      falhar('DATABASE_URL inválida; não é possível proteger o banco atual.');
    }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(atual.hostname);
    if (
      local &&
      `${atual.port || '5432'}/${decodeURIComponent(atual.pathname.slice(1))}` ===
        banco.identidade
    ) {
      falhar(
        'O destino é o banco configurado em DATABASE_URL. Use um banco de demonstração separado; o banco atual não será alterado.',
      );
    }
  }
  const senha = env.DEMO_ADMIN_PASSWORD;
  if (
    typeof senha !== 'string' ||
    senha.length < 8 ||
    Buffer.byteLength(senha) > 72
  ) {
    falhar(
      'Defina DEMO_ADMIN_PASSWORD com ao menos 8 caracteres e no máximo 72 bytes UTF-8.',
    );
  }
  let publico;
  try {
    publico = new URL(
      env.BACKEND_PUBLIC_URL || env.BACKEND_URL || 'http://localhost:3001',
    );
  } catch {
    falhar('BACKEND_PUBLIC_URL inválida.');
  }
  if (
    !['http:', 'https:'].includes(publico.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(publico.hostname) ||
    publico.username ||
    publico.password ||
    publico.search ||
    publico.hash ||
    publico.pathname !== '/'
  ) {
    falhar(
      'BACKEND_PUBLIC_URL deve ser a origem HTTP local que servirá uploads, sem credenciais, caminho ou parâmetros.',
    );
  }
  return {
    databaseUrl: banco.url,
    databaseName: banco.nome,
    port: banco.porta,
    password: senha,
    publicUrl: publico.origin,
  };
}

export function criarClienteDemo(config) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  });
}

export async function prepararDados() {
  const manifesto = JSON.parse(
    await readFile(join(dadosDir, 'manifesto.json'), 'utf8'),
  );
  if (
    manifesto.versao !== 1 ||
    manifesto.produtos.length !== 8 ||
    manifesto.avaliacoes.length !== 5
  )
    falhar('Manifesto de demonstração inválido.');
  const imagens = [];
  for (const produto of manifesto.produtos) {
    if (!/^[a-z]+\.jpg$/.test(produto.arquivo))
      falhar('Nome de imagem inválido no manifesto.');
    const buffer = await readFile(join(dadosDir, 'imagens', produto.arquivo));
    const convertido = await converterImagem({ buffer, size: buffer.length });
    imagens.push({ buffer: convertido, hash: hash(convertido) });
  }
  if (new Set(imagens.map((i) => i.hash)).size !== 8)
    falhar('As oito imagens devem ser distintas.');
  return {
    manifesto,
    imagens,
    assinatura: hash(
      JSON.stringify(manifesto) + imagens.map((i) => i.hash).join(''),
    ),
  };
}

function lerRegistro(descricao) {
  const pos = descricao?.indexOf(MARCA) ?? -1;
  if (pos < 0)
    falhar(
      'Já existe uma loja Sabor da Vila sem marca deste seed. Nada foi sobrescrito.',
    );
  let registro;
  try {
    registro = JSON.parse(descricao.slice(pos + MARCA.length));
  } catch {
    falhar('O registro de origem do seed está inválido; nada foi sobrescrito.');
  }
  if (
    registro.versao !== 1 ||
    !Number.isSafeInteger(registro.admin) ||
    !Number.isSafeInteger(registro.categoria) ||
    !Array.isArray(registro.produtos) ||
    registro.produtos.length !== 8 ||
    !Array.isArray(registro.avaliacoes) ||
    registro.avaliacoes.length !== 5
  ) {
    falhar(
      'O registro de origem do seed está incompleto; nada foi sobrescrito.',
    );
  }
  return registro;
}

function conferirUsuario(atual, esperado, id) {
  if (
    !atual ||
    atual.id !== id ||
    atual.nome !== esperado.nome ||
    atual.username !== esperado.username ||
    atual.email !== esperado.email
  ) {
    falhar(
      `Conflito com o usuário fictício ${esperado.username}. Nenhum usuário foi alterado.`,
    );
  }
}

function resumo(loja, registro, criado) {
  return {
    criado,
    lojaId: loja.id,
    usuarioId: registro.admin,
    categoriaId: registro.categoria,
    produtos: registro.produtos.map((p) => ({ id: p.id, imagemId: p.imagem })),
    avaliacoes: registro.avaliacoes,
    url: `/loja/${loja.id}`,
    media: 4.6,
  };
}

export async function executarDemo({
  prisma,
  config,
  dados,
  uploadsRoot = join(raiz, 'uploads'),
}) {
  const { manifesto, imagens, assinatura } = dados;
  const arquivosCriados = [];
  async function salvarArquivo(id, nome, imagem) {
    const caminho = join(uploadsRoot, 'produtos', String(id), nome);
    await mkdir(dirname(caminho), { recursive: true });
    await writeFile(caminho, imagem.buffer, { flag: 'wx' });
    arquivosCriados.push(caminho);
  }
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Serializa execuções concorrentes do mesmo seed nesta base.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('stockio-demo-sabor-da-vila-v1'))`;
        const loja = await tx.lojas.findUnique({
          where: { nome: manifesto.loja },
          include: {
            produtos: { include: { imagem: true } },
            avaliacoes_loja: true,
          },
        });
        if (loja) {
          const registro = lerRegistro(loja.descricao);
          if (
            registro.assinatura !== assinatura ||
            loja.usuario_id !== registro.admin ||
            loja.categoria_id !== registro.categoria ||
            loja.produtos.length !== 8 ||
            loja.avaliacoes_loja.length !== 5
          ) {
            falhar(
              'Os dados da loja ou a versão do manifesto divergem do seed. Nenhum registro foi sobrescrito.',
            );
          }
          const admin = await tx.usuarios.findUnique({
            where: { id: registro.admin },
          });
          conferirUsuario(admin, manifesto.administrador, registro.admin);
          if (!(await bcrypt.compare(config.password, admin.senha_hash)))
            falhar(
              'DEMO_ADMIN_PASSWORD não corresponde à conta existente. A senha não foi alterada.',
            );
          const categoria = await tx.categorias.findUnique({
            where: { id: registro.categoria },
          });
          if (
            categoria?.nome !== manifesto.categoria ||
            categoria.categoria_pai_id !== null
          )
            falhar(
              'A categoria da demonstração foi alterada. Nenhum registro foi sobrescrito.',
            );
          // Confere todos os registros e arquivos antes de restaurar arquivos ausentes.
          const ausentes = [];
          for (const [i, esperado] of manifesto.produtos.entries()) {
            const ref = registro.produtos[i];
            const atual = loja.produtos.find((p) => p.id === ref.id);
            if (
              !atual ||
              atual.nome !== esperado.nome ||
              atual.descricao !== esperado.descricao ||
              Number(atual.preco) !== Number(esperado.preco) ||
              atual.estoque !== esperado.estoque ||
              atual.categoria_id !== registro.categoria ||
              atual.imagem.length !== 1 ||
              !/^[0-9a-f-]{36}\.webp$/.test(ref.arquivo)
            ) {
              falhar(
                `Conflito no produto ${esperado.nome}. Nenhum registro foi sobrescrito.`,
              );
            }
            const url = `${config.publicUrl}/uploads/produtos/${atual.id}/${ref.arquivo}`;
            if (
              atual.imagem[0].id !== ref.imagem ||
              atual.imagem[0].url_imagem !== url ||
              atual.imagem[0].ordem !== 0
            )
              falhar(
                `Conflito na imagem de ${esperado.nome}; confira também BACKEND_PUBLIC_URL.`,
              );
            try {
              const conteudo = await readFile(
                join(uploadsRoot, 'produtos', String(atual.id), ref.arquivo),
              );
              if (hash(conteudo) !== imagens[i].hash)
                falhar(
                  `A imagem de ${esperado.nome} foi modificada. Ela não será substituída.`,
                );
            } catch (erro) {
              if (erro.code !== 'ENOENT') throw erro;
              ausentes.push({
                id: atual.id,
                nome: ref.arquivo,
                imagem: imagens[i],
              });
            }
          }
          for (const [i, esperado] of manifesto.avaliacoes.entries()) {
            const ref = registro.avaliacoes[i];
            const atual = loja.avaliacoes_loja.find((a) => a.id === ref.id);
            const usuario = await tx.usuarios.findUnique({
              where: { id: ref.usuarioId },
            });
            conferirUsuario(usuario, esperado.usuario, ref.usuarioId);
            if (
              !atual ||
              atual.usuario_id !== ref.usuarioId ||
              atual.usuario_id === registro.admin ||
              atual.nota !== esperado.nota ||
              atual.comentario !== esperado.comentario
            )
              falhar(
                'Conflito em uma avaliação de demonstração. Nada foi sobrescrito.',
              );
          }
          if (
            new Set([
              registro.admin,
              ...registro.avaliacoes.map((a) => a.usuarioId),
            ]).size !== 6
          )
            falhar('Os seis usuários de demonstração devem ser distintos.');
          for (const item of ausentes)
            await salvarArquivo(item.id, item.nome, item.imagem);
          return resumo(loja, registro, false);
        }

        // Sem loja marcada, nenhum usuário preexistente pode ser adotado.
        for (const usuario of [
          manifesto.administrador,
          ...manifesto.avaliacoes.map((a) => a.usuario),
        ]) {
          const existe = await tx.usuarios.findFirst({
            where: {
              OR: [{ username: usuario.username }, { email: usuario.email }],
            },
            select: { id: true },
          });
          if (existe)
            falhar(
              `Já existe ${usuario.username} ou seu e-mail sem origem comprovada neste seed. Nada foi sobrescrito.`,
            );
        }
        const categorias = await tx.categorias.findMany({
          where: { nome: manifesto.categoria, categoria_pai_id: null },
        });
        if (categorias.length > 1)
          falhar(
            'Há mais de uma categoria raiz Alimentos; resolva a ambiguidade antes de executar o seed.',
          );
        const categoria =
          categorias[0] ??
          (await tx.categorias.create({ data: { nome: manifesto.categoria } }));
        const usuarios = new UserService(tx);
        const produtosService = new ProdutosService(tx);
        const avaliacoesService = new AvaliacoesLojaService(tx);
        const admin = await usuarios.create({
          ...manifesto.administrador,
          senha: config.password,
        });
        const novaLoja = await tx.lojas.create({
          data: {
            nome: manifesto.loja,
            usuario_id: admin.id,
            categoria_id: categoria.id,
            descricao:
              '[Demonstração] Loja fictícia para testes acadêmicos Stock.io.',
          },
        });
        const registro = {
          versao: 1,
          assinatura,
          admin: admin.id,
          categoria: categoria.id,
          produtos: [],
          avaliacoes: [],
        };
        for (const [i, esperado] of manifesto.produtos.entries()) {
          const produto = await produtosService.create(admin.id, {
            loja_id: novaLoja.id,
            categoria_id: categoria.id,
            nome: esperado.nome,
            descricao: esperado.descricao,
            preco: Number(esperado.preco),
            estoque: esperado.estoque,
          });
          const arquivo = `${randomUUID()}.webp`;
          await salvarArquivo(produto.id, arquivo, imagens[i]);
          const imagem = await tx.imagens_Produtos.create({
            data: {
              produto_id: produto.id,
              url_imagem: `${config.publicUrl}/uploads/produtos/${produto.id}/${arquivo}`,
              ordem: 0,
            },
          });
          registro.produtos.push({
            id: produto.id,
            imagem: imagem.id,
            arquivo,
          });
        }
        for (const esperado of manifesto.avaliacoes) {
          // Senha aleatória descartada: não é salva em texto puro ou em arquivo.
          const usuario = await usuarios.create({
            ...esperado.usuario,
            senha: randomBytes(48).toString('base64url'),
          });
          const avaliacao = await avaliacoesService.create(usuario.id, {
            loja_id: novaLoja.id,
            nota: esperado.nota,
            comentario: esperado.comentario,
          });
          registro.avaliacoes.push({ id: avaliacao.id, usuarioId: usuario.id });
        }
        await tx.lojas.update({
          where: { id: novaLoja.id },
          data: {
            descricao: `[Demonstração] Loja fictícia para testes acadêmicos Stock.io.${MARCA}${JSON.stringify(registro)}`,
          },
        });
        return resumo(novaLoja, registro, true);
      },
      { isolationLevel: 'Serializable', timeout: 30_000, maxWait: 10_000 },
    );
  } catch (erro) {
    // Só remove arquivos criados por esta tentativa; o banco faz rollback.
    await Promise.all(
      arquivosCriados.map((caminho) => unlink(caminho).catch(() => undefined)),
    );
    throw erro;
  }
}

async function main() {
  let prisma;
  try {
    const config = configurarDemo(); // Valida destino e senha antes de conectar.
    const dados = await prepararDados();
    prisma = criarClienteDemo(config);
    const resultado = await executarDemo({ prisma, config, dados });
    console.log(
      JSON.stringify(
        { banco: config.databaseName, porta: config.port, ...resultado },
        null,
        2,
      ),
    );
    console.log(
      'Acesso: admin.sabor.vila@example.com; senha fornecida por DEMO_ADMIN_PASSWORD (não exibida).',
    );
  } catch (erro) {
    console.error(
      erro instanceof DemoError
        ? erro.message
        : 'O seed não foi concluído. Verifique o banco, o schema e os arquivos; detalhes internos e credenciais não são exibidos.',
    );
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
