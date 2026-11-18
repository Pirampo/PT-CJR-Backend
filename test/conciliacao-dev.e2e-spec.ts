// Integração das rotas das duas branches, sem acesso ao PostgreSQL.
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import {
  mkdtemp,
  mkdir,
  readdir,
  rm,
  writeFile,
  readFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configurarUploads } from '../src/uploads-static.js';

const DONO = 101;
const OUTRO = 102;
const PRODUTO = 201;
const LOJA = 12;
const LEGADO = 'eaf42510-d8f1-40ad-a95e-a0c602c51882.jpg';
type Imagem = {
  id: number;
  produto_id: number;
  url_imagem: string;
  ordem: number;
};
type Comentario = {
  id: number;
  usuario_id: number;
  conteudo: string;
  avaliacao_loja_id?: number;
  avaliacao_produto_id?: number;
};
let imagens: Imagem[];
let comentarios: Comentario[];
let sequencia = 1;
let falharAtualizacao = false;
let produtoExiste = true;
let hash: string;
const prisma = {
  usuarios: {
    findUnique: vi.fn(async ({ where }) =>
      ['dono@example.test', 'outro@example.test'].includes(where.email)
        ? {
            id: where.email.startsWith('dono') ? DONO : OUTRO,
            email: where.email,
            senha_hash: hash,
          }
        : null,
    ),
  },
  lojas: {
    findMany: vi.fn(async ({ where }) =>
      where.usuario_id === DONO ? [{ id: LOJA, usuario_id: DONO }] : [],
    ),
    findFirst: vi.fn(async ({ where }) =>
      where.id === LOJA && where.usuario_id === DONO
        ? { id: LOJA, usuario_id: DONO }
        : null,
    ),
    findUnique: vi.fn(async ({ where }) =>
      where.id === LOJA ? { id: LOJA, usuario_id: DONO } : null,
    ),
  },
  produtos: {
    findMany: vi.fn(async ({ where } = {}) =>
      !where || where.lojas.usuario_id === DONO
        ? [{ id: PRODUTO, imagem: imagens }]
        : [],
    ),
    findUnique: vi.fn(async ({ where }) =>
      produtoExiste && where.id === PRODUTO
        ? {
            id: PRODUTO,
            lojas: { usuario_id: DONO },
            imagem: [...imagens].sort((a, b) => a.ordem - b.ordem),
          }
        : null,
    ),
    create: vi.fn(async ({ data }) => ({ id: 202, ...data })),
    update: vi.fn(async ({ data }) => ({ id: PRODUTO, ...data })),
    delete: vi.fn(async () => {
      produtoExiste = false;
      return { id: PRODUTO };
    }),
  },
  imagens_Produtos: {
    aggregate: vi.fn(async () => ({
      _max: {
        ordem: imagens.length ? Math.max(...imagens.map((i) => i.ordem)) : null,
      },
    })),
    findFirst: vi.fn(
      async ({ where }) =>
        imagens.find(
          (i) => i.id === where.id && i.produto_id === where.produto_id,
        ) ?? null,
    ),
    create: vi.fn(async ({ data }) => {
      const imagem = { id: sequencia++, ...data };
      imagens.push(imagem);
      return imagem;
    }),
    update: vi.fn(async ({ where, data }) => {
      if (falharAtualizacao) throw new Error('Falha simulada de persistência');
      const i = imagens.findIndex((i) => i.id === where.id);
      return (imagens[i] = { ...imagens[i], ...data });
    }),
    delete: vi.fn(async ({ where }) => {
      const i = imagens.findIndex((i) => i.id === where.id);
      return imagens.splice(i, 1)[0];
    }),
    updateMany: vi.fn(async ({ where }) => {
      imagens = imagens.map((i) =>
        i.produto_id === where.produto_id && i.ordem > where.ordem.gt
          ? { ...i, ordem: i.ordem - 1 }
          : i,
      );
      return { count: imagens.length };
    }),
  },
  avaliacoes_Loja: {
    findUnique: vi.fn(async ({ where }) =>
      where.id === 301
        ? { id: 301, usuario_id: DONO, loja_id: LOJA, nota: 5 }
        : null,
    ),
    findMany: vi.fn(async () => [
      { id: 301, usuario_id: DONO, loja_id: LOJA, nota: 5 },
    ]),
    create: vi.fn(async ({ data }) => ({ id: 303, ...data })),
    update: vi.fn(async ({ data }) => ({ id: 301, ...data })),
    delete: vi.fn(async () => ({ id: 301 })),
  },
  avaliacoes_Produtos: {
    findUnique: vi.fn(async ({ where }) =>
      where.id === 302
        ? { id: 302, usuario_id: DONO, produto_id: PRODUTO, nota: 4 }
        : null,
    ),
    findMany: vi.fn(async () => [
      { id: 302, usuario_id: DONO, produto_id: PRODUTO, nota: 4 },
    ]),
    create: vi.fn(async ({ data }) => ({ id: 304, ...data })),
    update: vi.fn(async ({ data }) => ({ id: 302, ...data })),
    delete: vi.fn(async () => ({ id: 302 })),
  },
  comentarios_Avaliacoes: {
    findMany: vi.fn(async ({ where }) =>
      comentarios.filter(
        (c) =>
          (!where.avaliacao_loja_id ||
            c.avaliacao_loja_id === where.avaliacao_loja_id) &&
          (!where.avaliacao_produto_id ||
            c.avaliacao_produto_id === where.avaliacao_produto_id),
      ),
    ),
    findUnique: vi.fn(
      async ({ where }) => comentarios.find((c) => c.id === where.id) ?? null,
    ),
    create: vi.fn(async ({ data }) => {
      const c = { id: comentarios.length + 1, ...data };
      comentarios.push(c);
      return c;
    }),
    update: vi.fn(async ({ where, data }) => {
      const i = comentarios.findIndex((c) => c.id === where.id);
      return (comentarios[i] = { ...comentarios[i], ...data });
    }),
    delete: vi.fn(async ({ where }) => {
      const i = comentarios.findIndex((c) => c.id === where.id);
      return comentarios.splice(i, 1)[0];
    }),
  },
  $transaction: vi.fn(async (callback) => callback(prisma)),
};

describe('Conciliação dev: imagens, rotas me, CRUD e comentários', () => {
  let app: INestApplication;
  let cwd: string;
  let temporario: string;
  let dono: string;
  let outro: string;
  let png: Buffer;
  const http = () => request(app.getHttpServer());
  const enviar = (rota = 'imagem', token = dono, arquivo = png) =>
    http()
      .post(`/produtos/${PRODUTO}/${rota}`)
      .set('Authorization', `Bearer ${token}`)
      .attach('imagem', arquivo, 'produto.png');
  const trocar = (id: number, token = dono, arquivo = png) =>
    http()
      .patch(`/produtos/${PRODUTO}/imagens/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .attach('imagem', arquivo, 'produto.png');
  const caminho = (url: string) =>
    new URL(url, 'http://localhost:3001').pathname;
  const arquivos = () =>
    readdir(join(temporario, 'uploads', 'produtos', String(PRODUTO))).catch(
      () => [],
    );

  beforeAll(async () => {
    cwd = process.cwd();
    temporario = await mkdtemp(join(tmpdir(), 'stockio-conciliacao-'));
    hash = await bcrypt.hash('senha-exclusiva-teste', 4);
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = modulo.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    process.chdir(temporario);
    configurarUploads(app);
    await app.init();
    for (const email of ['dono@example.test', 'outro@example.test']) {
      const login = await http()
        .post('/login')
        .send({ email, senha: 'senha-exclusiva-teste' })
        .expect(200);
      if (email.startsWith('dono')) dono = login.body.access_token;
      else outro = login.body.access_token;
    }
    png = await sharp({
      create: { width: 40, height: 20, channels: 4, background: '#7137f580' },
    })
      .png()
      .toBuffer();
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    imagens = [];
    comentarios = [];
    sequencia = 1;
    falharAtualizacao = false;
    produtoExiste = true;
    await rm(join(temporario, 'uploads'), { recursive: true, force: true });
  });
  afterAll(async () => {
    await app?.close();
    process.chdir(cwd);
    await rm(temporario, { recursive: true, force: true });
  });

  it.each(['/lojas/me', '/produtos/me'])(
    'preserva %s protegido e anterior a :id',
    async (rota) => {
      await http().get(rota).expect(401);
      const resposta = await http()
        .get(rota)
        .set('Authorization', `Bearer ${dono}`)
        .expect(200);
      expect(resposta.body[0].id).toBe(rota.includes('lojas') ? LOJA : PRODUTO);
      const vazio = await http()
        .get(rota)
        .set('Authorization', `Bearer ${outro}`)
        .expect(200);
      if (rota.includes('lojas'))
        expect(vazio.text).toBe('Nenhuma loja cadastrada por você.');
      else expect(vazio.body).toEqual([]);
    },
  );

  it.each(['imagem', 'imagens'])(
    'preserva POST %s, consulta pública e WebP',
    async (rota) => {
      await http().post(`/produtos/${PRODUTO}/${rota}`).expect(401);
      await enviar(rota, outro).expect(403);
      const imagem = (await enviar(rota).expect(201)).body;
      const lista = await http()
        .get(`/produtos/${PRODUTO}/imagens`)
        .expect(200);
      expect(lista.body).toEqual([imagem]);
      await http()
        .get(`/produtos/${PRODUTO}/imagens/${imagem.id}`)
        .expect(200)
        .expect(imagem);
      const arquivo = await http().get(caminho(imagem.url_imagem)).expect(200);
      expect(arquivo.headers['x-content-type-options']).toBe('nosniff');
      expect((await sharp(arquivo.body).metadata()).format).toBe('webp');
    },
  );

  it('mantém 2 MB no plural e 5 MB no singular e na substituição', async () => {
    const grande = Buffer.concat([png, Buffer.alloc(3 * 1024 * 1024)]);
    await enviar('imagens', dono, grande).expect(413);
    const imagem = (await enviar('imagem', dono, grande).expect(201)).body;
    await trocar(imagem.id, dono, grande).expect(200);
    await enviar('imagem', dono, Buffer.alloc(5 * 1024 * 1024 + 1)).expect(413);
    await trocar(imagem.id, dono, Buffer.alloc(5 * 1024 * 1024 + 1)).expect(
      413,
    );
  });

  it.each([
    Buffer.from('falso'),
    Buffer.from('<svg/>'),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  ])(
    'recusa conteúdo falso no upload de 5 MB e na substituição',
    async (arquivo) => {
      await enviar('imagem', dono, arquivo).expect(400);
      const imagem = (await enviar().expect(201)).body;
      await trocar(imagem.id, dono, arquivo).expect(400);
      expect(imagens[0].url_imagem).toBe(imagem.url_imagem);
    },
  );

  it('substitui após persistir; mantém ordem e remove arquivo antigo', async () => {
    const antiga = (await enviar().expect(201)).body;
    await trocar(antiga.id, outro).expect(403);
    await trocar(999).expect(404);
    const nova = (await trocar(antiga.id).expect(200)).body;
    expect(nova.ordem).toBe(antiga.ordem);
    expect(nova.url_imagem).not.toBe(antiga.url_imagem);
    await http().get(caminho(antiga.url_imagem)).expect(404);
    await http().get(caminho(nova.url_imagem)).expect(200);
    expect(await arquivos()).toHaveLength(1);
  });

  it('falha no banco preserva o arquivo anterior e elimina apenas o novo', async () => {
    const antiga = (await enviar().expect(201)).body;
    falharAtualizacao = true;
    await trocar(antiga.id).expect(500);
    expect(imagens[0].url_imagem).toBe(antiga.url_imagem);
    await http().get(caminho(antiga.url_imagem)).expect(200);
    expect(await arquivos()).toHaveLength(1);
  });

  it('exclui uma imagem e reordena somente as demais do produto', async () => {
    const primeira = (await enviar().expect(201)).body;
    const segunda = (await enviar().expect(201)).body;
    await http()
      .delete(`/produtos/${PRODUTO}/imagens/${primeira.id}`)
      .expect(401);
    await http()
      .delete(`/produtos/${PRODUTO}/imagens/${primeira.id}`)
      .set('Authorization', `Bearer ${outro}`)
      .expect(403);
    await http()
      .delete(`/produtos/${PRODUTO}/imagens/${primeira.id}`)
      .set('Authorization', `Bearer ${dono}`)
      .expect(200);
    expect(imagens).toHaveLength(1);
    expect(imagens[0]).toMatchObject({ id: segunda.id, ordem: 0 });
    await http().get(caminho(primeira.url_imagem)).expect(404);
    await http().get(caminho(segunda.url_imagem)).expect(200);
  });

  it('serve e substitui imagem legada relativa sem migrar registros', async () => {
    await mkdir(join(temporario, 'uploads', 'produtos'), { recursive: true });
    await writeFile(
      join(temporario, 'uploads', 'produtos', LEGADO),
      await sharp(png).jpeg().toBuffer(),
    );
    imagens.push({
      id: 1,
      produto_id: PRODUTO,
      ordem: 0,
      url_imagem: `/uploads/produtos/${LEGADO}`,
    });
    await http().get(imagens[0].url_imagem).expect(200);
    await trocar(1).expect(200);
    await http().get(`/uploads/produtos/${LEGADO}`).expect(404);
    expect(imagens[0].url_imagem).toMatch(/\.webp$/);
  });

  it.each([
    `https://externo.example/uploads/produtos/${LEGADO}`,
    `/uploads/produtos/999/${LEGADO}`,
    `/uploads/produtos/../produtos/${LEGADO}`,
  ])(
    'não apaga arquivos por URL externa ou caminho indevido: %s',
    async (url) => {
      await mkdir(join(temporario, 'uploads', 'produtos'), { recursive: true });
      const sentinela = join(temporario, 'uploads', 'produtos', LEGADO);
      await writeFile(sentinela, 'preservar');
      imagens.push({ id: 1, produto_id: PRODUTO, ordem: 0, url_imagem: url });
      await trocar(1).expect(200);
      expect(await readFile(sentinela, 'utf8')).toBe('preservar');
    },
  );

  it('mantém autorização do CRUD de produto e limpeza das imagens ao excluir', async () => {
    const dto = {
      nome: 'Produto teste',
      categoria_id: 1,
      preco: 10,
      estoque: 5,
      loja_id: LOJA,
    };
    await http()
      .post('/produtos')
      .set('Authorization', `Bearer ${outro}`)
      .send(dto)
      .expect(403);
    await http()
      .post('/produtos')
      .set('Authorization', `Bearer ${dono}`)
      .send(dto)
      .expect(201);
    await http()
      .patch(`/produtos/${PRODUTO}`)
      .set('Authorization', `Bearer ${outro}`)
      .send({ nome: 'Novo' })
      .expect(403);
    await http()
      .patch(`/produtos/${PRODUTO}`)
      .set('Authorization', `Bearer ${dono}`)
      .send({ nome: 'Novo', loja_id: 99 })
      .expect(200);
    expect(prisma.produtos.update).toHaveBeenCalledWith({
      where: { id: PRODUTO },
      data: { nome: 'Novo' },
    });
    const imagem = (await enviar().expect(201)).body;
    await http()
      .delete(`/produtos/${PRODUTO}`)
      .set('Authorization', `Bearer ${outro}`)
      .expect(403);
    await http()
      .delete(`/produtos/${PRODUTO}`)
      .set('Authorization', `Bearer ${dono}`)
      .expect(200);
    await http().get(caminho(imagem.url_imagem)).expect(404);
  });

  it('mantém comentários públicos, criação autenticada e edição/exclusão por autor', async () => {
    const dto = { conteudo: '  Demonstração  ', avaliacao_loja_id: 301 };
    await http().post('/comentarios').send(dto).expect(401);
    const criado = (
      await http()
        .post('/comentarios')
        .set('Authorization', `Bearer ${dono}`)
        .send(dto)
        .expect(201)
    ).body;
    expect(criado).toMatchObject({
      usuario_id: DONO,
      conteudo: 'Demonstração',
    });
    await http().get(`/comentarios/${criado.id}`).expect(200);
    const lista = await http()
      .get('/comentarios?avaliacao_loja_id=301')
      .expect(200);
    expect(lista.body).toHaveLength(1);
    await http()
      .patch(`/comentarios/${criado.id}`)
      .set('Authorization', `Bearer ${outro}`)
      .send({ conteudo: 'Alheio' })
      .expect(403);
    await http()
      .delete(`/comentarios/${criado.id}`)
      .set('Authorization', `Bearer ${outro}`)
      .expect(403);
    await http()
      .patch(`/comentarios/${criado.id}`)
      .set('Authorization', `Bearer ${dono}`)
      .send({ conteudo: 'Editado' })
      .expect(200);
    await http()
      .delete(`/comentarios/${criado.id}`)
      .set('Authorization', `Bearer ${dono}`)
      .expect(200);
    await http().get(`/comentarios/${criado.id}`).expect(404);
  });

  it.each([
    { conteudo: '   ', avaliacao_loja_id: 301 },
    { conteudo: 'Demo' },
    { conteudo: 'Demo', avaliacao_loja_id: 301, avaliacao_produto_id: 302 },
    { conteudo: 'Demo', avaliacao_loja_id: 999 },
  ])('preserva validações de comentário: %j', async (dto) => {
    await http()
      .post('/comentarios')
      .set('Authorization', `Bearer ${dono}`)
      .send(dto)
      .expect(dto.avaliacao_loja_id === 999 ? 404 : 400);
    expect(comentarios).toHaveLength(0);
  });

  it.each([
    ['avaliacoes-loja', 301, { loja_id: LOJA, nota: 5 }],
    ['avaliacoes-produtos', 302, { produto_id: PRODUTO, nota: 4 }],
  ] as const)('preserva CRUD e autoria de %s', async (rota, id, dto) => {
    await http().get(`/${rota}`).expect(200);
    await http().get(`/${rota}/${id}`).expect(200);
    await http().post(`/${rota}`).send(dto).expect(401);
    const criado = await http()
      .post(`/${rota}`)
      .set('Authorization', `Bearer ${outro}`)
      .send(dto)
      .expect(201);
    expect(criado.body.usuario_id).toBe(OUTRO);
    await http()
      .patch(`/${rota}/${id}`)
      .set('Authorization', `Bearer ${outro}`)
      .send({ nota: 3 })
      .expect(403);
    await http()
      .delete(`/${rota}/${id}`)
      .set('Authorization', `Bearer ${outro}`)
      .expect(403);
    await http()
      .patch(`/${rota}/${id}`)
      .set('Authorization', `Bearer ${dono}`)
      .send({ nota: 3 })
      .expect(200);
    await http()
      .delete(`/${rota}/${id}`)
      .set('Authorization', `Bearer ${dono}`)
      .expect(200);
  });
});
