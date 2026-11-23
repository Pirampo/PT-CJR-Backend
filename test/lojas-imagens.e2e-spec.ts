// Testes de autorização e upload de imagens das lojas.
// O PrismaService é substituído por um mock em memória: nenhum dado é lido
// ou gravado no PostgreSQL. Os uploads vão para um diretório temporário.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import sharp from 'sharp';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { configurarUploads } from './../src/uploads-static.js';

type LojaMock = {
  id: number;
  usuario_id: number;
  categoria_id: number | null;
  nome: string;
  descricao: string | null;
  logo_url: string | null;
  banner_url: string | null;
  sticker_url: string | null;
  foto_perfil_url: string | null;
};

const DONO = 6;
const OUTRO = 7;
const BASE = 'http://localhost:3001';

let lojas: Map<number, LojaMock>;
let usuarioDono: { id: number; nome: string; username: string; email: string; foto_perfil_url: null; lojas: never[] };

const prismaMock = {
  lojas: {
    findUnique: vi.fn(async ({ where, include }: { where: { id?: number; nome?: string }; include?: unknown }) => {
      const loja = where.id !== undefined
        ? lojas.get(where.id)
        : [...lojas.values()].find((l) => l.nome === where.nome);
      if (!loja) return null;
      if (!include) return { ...loja };
      return {
        ...loja,
        categoria: { id: 5, nome: 'Beleza' },
        usuario: { id: loja.usuario_id, nome: 'Dono Teste', foto_perfil_url: null },
        produtos: [],
        avaliacoes_loja: [],
      };
    }),
    findFirst: vi.fn(async ({ where }: { where: { id: number; usuario_id: number } }) => {
      const loja = lojas.get(where.id);
      return loja && loja.usuario_id === where.usuario_id ? { ...loja } : null;
    }),
    findMany: vi.fn(async () => [...lojas.values()]),
    update: vi.fn(async ({ where, data }: { where: { id: number }; data: Partial<LojaMock> }) => {
      const loja = { ...lojas.get(where.id)!, ...data };
      lojas.set(where.id, loja);
      return loja;
    }),
    create: vi.fn(),
    delete: vi.fn(),
  },
  usuarios: {
    findUnique: vi.fn(async ({ where, select }: { where: { id?: number }; select?: Record<string, unknown> }) => {
      if (where.id !== DONO) return null;
      return select
        ? Object.fromEntries(Object.entries(usuarioDono).filter(([campo]) => select[campo]))
        : { ...usuarioDono };
    }),
    update: vi.fn(async ({ data }: { data: Partial<typeof usuarioDono> }) => {
      usuarioDono = { ...usuarioDono, ...data };
      return { ...usuarioDono };
    }),
  },
};

describe('Lojas: leitura pública, autorização e upload de imagens (e2e)', () => {
  let app: INestApplication<App>;
  let tokenDono: string;
  let tokenOutro: string;
  let pastaTemporaria: string;
  let cwdOriginal: string;
  let png: Buffer;

  beforeAll(async () => {
    cwdOriginal = process.cwd();
    pastaTemporaria = await mkdtemp(join(tmpdir(), 'stockio-uploads-'));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    // Os uploads usam process.cwd(): aponta para a pasta temporária.
    process.chdir(pastaTemporaria);
    configurarUploads(app);
    await app.init();

    const jwt = app.get(JwtService);
    const secret = app.get(ConfigService).get<string>('JWT_SECRET');
    tokenDono = await jwt.signAsync({ sub: DONO, email: 'dono@teste' }, { secret });
    tokenOutro = await jwt.signAsync({ sub: OUTRO, email: 'outro@teste' }, { secret });

    png = await sharp({
      create: { width: 40, height: 20, channels: 3, background: '#6A38F3' },
    }).png().toBuffer();
  });

  beforeEach(async () => {
    // Cada cenário começa sem arquivos deixados pelos outros uploads.
    await rm(join(pastaTemporaria, 'uploads'), { recursive: true, force: true });
    usuarioDono = { id: DONO, nome: 'Dono Teste', username: 'dono', email: 'dono@teste.com', foto_perfil_url: null, lojas: [] };
    prismaMock.usuarios.update.mockClear();
    lojas = new Map([
      [11, {
        id: 11, usuario_id: DONO, categoria_id: 5, nome: 'Loja Teste',
        descricao: null, logo_url: null, banner_url: null, sticker_url: null, foto_perfil_url: null,
      }],
    ]);
  });

  afterAll(async () => {
    await app?.close();
    process.chdir(cwdOriginal);
    await rm(pastaTemporaria, { recursive: true, force: true });
  });

  const servidor = () => app.getHttpServer();

  it('GET /lojas/:id é público e não expõe e-mail do dono', async () => {
    const resposta = await request(servidor()).get('/lojas/11').expect(200);
    expect(resposta.body).toMatchObject({ id: 11, usuario: { id: DONO }, media_avaliacoes: null });
    expect(JSON.stringify(resposta.body)).not.toMatch(/email|senha/);
  });

  it('GET /lojas é público', async () => {
    await request(servidor()).get('/lojas').expect(200);
  });

  it('GET /user/:id é público e não expõe e-mail', async () => {
    const resposta = await request(servidor()).get(`/user/${DONO}`).expect(200);
    expect(resposta.body).toMatchObject({ id: DONO, username: 'dono' });
    expect(resposta.body).not.toHaveProperty('email');
  });

  it('oculta username com e-mail no perfil público, preservando dados privados em /user/me', async () => {
    usuarioDono.username = usuarioDono.email;
    const publico = await request(servidor()).get(`/user/${DONO}`).expect(200);
    expect(publico.body.username).toBeNull();
    expect(publico.body.nome).toBe('Dono Teste');
    expect(JSON.stringify(publico.body)).not.toContain(usuarioDono.email);
    const privado = await request(servidor()).get('/user/me').set('Authorization', `Bearer ${tokenDono}`).expect(200);
    expect(privado.body.username).toBe(usuarioDono.email);
  });

  it('PATCH de perfil sem sessão é recusado', async () => {
    await request(servidor()).patch(`/user/${DONO}`).send({ nome: 'Sem sessão' }).expect(401);
    expect(prismaMock.usuarios.update).not.toHaveBeenCalled();
  });

  it('outro usuário não pode editar o perfil do dono', async () => {
    await request(servidor()).patch(`/user/${DONO}`).set('Authorization', `Bearer ${tokenOutro}`).send({ nome: 'Invasão' }).expect(403);
    expect(prismaMock.usuarios.update).not.toHaveBeenCalled();
  });

  it('dono salva campos de perfil pelo service e a leitura seguinte reflete a alteração (Prisma em memória)', async () => {
    await request(servidor()).patch(`/user/${DONO}`).set('Authorization', `Bearer ${tokenDono}`)
      .send({ nome: 'Nome Atualizado', username: 'dono_atualizado', email: 'novo@teste.com' }).expect(200);
    expect(prismaMock.usuarios.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: DONO }, data: expect.objectContaining({ nome: 'Nome Atualizado', username: 'dono_atualizado', email: 'novo@teste.com' }) }));
    const perfil = await request(servidor()).get(`/user/${DONO}`).expect(200);
    expect(perfil.body).toMatchObject({ nome: 'Nome Atualizado', username: 'dono_atualizado' });
  });

  it('recusa e-mail inválido antes de atualizar o perfil', async () => {
    await request(servidor()).patch(`/user/${DONO}`).set('Authorization', `Bearer ${tokenDono}`).send({ email: 'invalido' }).expect(400);
    expect(prismaMock.usuarios.update).not.toHaveBeenCalled();
  });

  it.each(['svg', 'png', 'jpg', 'jpeg', 'webp'])('recusa logo .%s acima de 2 MB sem atualizar imagens', async (extensao) => {
    await request(servidor()).post('/lojas/11/imagens/logo').set('Authorization', `Bearer ${tokenDono}`)
      .attach('logo', Buffer.alloc(2 * 1024 * 1024 + 1, ' '), `grande.${extensao}`).expect(413);
    expect(lojas.get(11)!.logo_url).toBeNull();
  });

  it.each([
    ['post', '/lojas'],
    ['patch', '/lojas/11'],
    ['delete', '/lojas/11'],
    ['post', '/lojas/11/imagens/banner'],
    ['post', '/lojas/11/imagens/foto-perfil'],
    ['post', '/lojas/11/imagens/logo'],
  ] as const)('%s %s sem token responde 401', async (metodo, rota) => {
    await request(servidor())[metodo](rota).expect(401);
  });

  it('não dono não consegue alterar imagens (403)', async () => {
    for (const [rota, campo, arquivo, nome] of [
      ['banner', 'banner', png, 'b.png'],
      ['foto-perfil', 'foto', png, 'f.png'],
      ['logo', 'logo', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'l.svg'],
      ['logo', 'logo', png, 'l.png'],
    ] as const) {
      await request(servidor())
        .post(`/lojas/11/imagens/${rota}`)
        .set('Authorization', `Bearer ${tokenOutro}`)
        .attach(campo, arquivo, nome)
        .expect(403);
    }
    expect(lojas.get(11)).toMatchObject({ banner_url: null, foto_perfil_url: null, logo_url: null });
  });

  it('recusa arquivo com extensão .png falsa (400)', async () => {
    await request(servidor())
      .post('/lojas/11/imagens/foto-perfil')
      .set('Authorization', `Bearer ${tokenDono}`)
      .attach('foto', Buffer.from('isto não é uma imagem'), { filename: 'f.png', contentType: 'image/png' })
      .expect(400);
  });

  it('recusa SVG com script (400) e não publica nada', async () => {
    const resposta = await request(servidor())
      .post('/lojas/11/imagens/logo')
      .set('Authorization', `Bearer ${tokenDono}`)
      .attach('logo', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'l.svg')
      .expect(400);
    expect(resposta.body.message).toMatch(/script/);
    expect(lojas.get(11)!.logo_url).toBeNull();
  });

  it.each(['png', 'jpg', 'jpeg', 'webp'])('armazena logo .%s em WebP e disponibiliza a URL na leitura pública', async (extensao) => {
    const formato = extensao === 'jpg' ? 'jpeg' : extensao;
    const arquivo = await sharp(png).toFormat(formato as 'png' | 'jpeg' | 'webp').toBuffer();
    const resposta = await request(servidor())
      .post('/lojas/11/imagens/logo')
      .set('Authorization', `Bearer ${tokenDono}`)
      .attach('logo', arquivo, `logo.${extensao}`)
      .expect(201);

    const url = resposta.body.logo_url as string;
    expect(url).toMatch(/\/uploads\/lojas\/11\/[0-9a-f-]{36}\.webp$/);
    expect(lojas.get(11)!.logo_url).toBe(url);
    const loja = await request(servidor()).get('/lojas/11').expect(200);
    expect(loja.body.logo_url).toBe(url);
    const imagem = await request(servidor()).get(url.slice(BASE.length)).expect(200);
    expect(imagem.headers['content-type']).toBe('image/webp');
    expect(imagem.headers['x-content-type-options']).toBe('nosniff');
    expect(await sharp(imagem.body as Buffer).metadata()).toMatchObject({ format: 'webp', width: 512, height: 256 });
  });

  it('aceita raster pelo conteúdo real mesmo com extensão e MIME diferentes', async () => {
    await request(servidor()).post('/lojas/11/imagens/logo')
      .set('Authorization', `Bearer ${tokenDono}`)
      .attach('logo', png, { filename: 'logo.svg', contentType: 'image/svg+xml' }).expect(201);
    expect(lojas.get(11)!.logo_url).toMatch(/\.webp$/);
  });

  it.each([
    ['logo.png', Buffer.from('arquivo falso'), 'image/png'],
    ['logo.jpg', Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'],
    ['logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'],
    ['logo.webp', Buffer.from('RIFF0000WEBP'), 'image/webp'],
    ['logo.png', Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'), 'image/png'],
    ['logo.png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/png'],
    ['logo.webp', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><use href="https://externo/logo.svg"/></svg>'), 'image/webp'],
  ])('recusa conteúdo inválido ou perigoso disfarçado de %s', async (filename, arquivo, contentType) => {
    await request(servidor()).post('/lojas/11/imagens/logo')
      .set('Authorization', `Bearer ${tokenDono}`)
      .attach('logo', arquivo, { filename, contentType }).expect(400);
    expect(lojas.get(11)!.logo_url).toBeNull();
  });

  it('substitui logo SVG por PNG e remove a versão anterior', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    const enviar = (arquivo: Buffer, filename: string) => request(servidor())
      .post('/lojas/11/imagens/logo').set('Authorization', `Bearer ${tokenDono}`)
      .attach('logo', arquivo, filename).expect(201);
    const anterior = (await enviar(svg, 'logo.svg')).body.logo_url as string;
    const atual = (await enviar(png, 'logo.png')).body.logo_url as string;
    expect(atual).not.toBe(anterior);
    const arquivos = await readdir(join(pastaTemporaria, 'uploads', 'lojas', '11'));
    expect(arquivos).toContain(atual.split('/').pop());
    expect(arquivos).not.toContain(anterior.split('/').pop());
    await request(servidor()).get(atual.slice(BASE.length)).expect(200);
    await request(servidor()).get(anterior.slice(BASE.length)).expect(404);
  });

  it('dono envia banner, foto e logo; URLs .webp são persistidas e servidas com nosniff', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#C6E700"/></svg>',
    );

    for (const [rota, campo, arquivo, nome, coluna] of [
      ['banner', 'banner', png, 'b.png', 'banner_url'],
      ['foto-perfil', 'foto', png, 'f.png', 'foto_perfil_url'],
      ['logo', 'logo', svg, 'l.svg', 'logo_url'],
    ] as const) {
      const resposta = await request(servidor())
        .post(`/lojas/11/imagens/${rota}`)
        .set('Authorization', `Bearer ${tokenDono}`)
        .attach(campo, arquivo, nome)
        .expect(201);

      const url: string = resposta.body[coluna];
      expect(url).toMatch(new RegExp(`^${BASE}/uploads/lojas/11/[0-9a-f-]{36}\\.webp$`));
      expect(lojas.get(11)![coluna]).toBe(url);

      const arquivoPublico = await request(servidor())
        .get(url.slice(BASE.length))
        .expect(200);
      expect(arquivoPublico.headers['x-content-type-options']).toBe('nosniff');
      expect(arquivoPublico.headers['content-type']).toBe('image/webp');
      expect((await sharp(arquivoPublico.body as Buffer).metadata()).format).toBe('webp');
    }

    // A logo publicada é WebP; nenhum SVG fica na pasta pública.
    const arquivos = await readdir(join(pastaTemporaria, 'uploads', 'lojas', '11'));
    expect(arquivos).toHaveLength(3);
    expect(arquivos.every((nome) => nome.endsWith('.webp'))).toBe(true);
  });

  it('substituir o banner remove o arquivo anterior', async () => {
    const enviar = () =>
      request(servidor())
        .post('/lojas/11/imagens/banner')
        .set('Authorization', `Bearer ${tokenDono}`)
        .attach('banner', png, 'b.png')
        .expect(201);

    const pasta = join(pastaTemporaria, 'uploads', 'lojas', '11');
    const antes = (await readdir(pasta).catch(() => [])).length;
    const primeiro = (await enviar()).body.banner_url as string;
    const segundo = (await enviar()).body.banner_url as string;

    expect(segundo).not.toBe(primeiro);
    const depois = await readdir(pasta);
    expect(depois).toHaveLength(antes + 1);
    expect(depois).toContain(segundo.split('/').pop());
    expect(depois).not.toContain(primeiro.split('/').pop());
  });

  it('PATCH com banner_url externo responde 400', async () => {
    await request(servidor())
      .patch('/lojas/11')
      .set('Authorization', `Bearer ${tokenDono}`)
      .send({ banner_url: 'https://externo.example/banner.png' })
      .expect(400);
  });

  it('PATCH de nome/descrição continua funcionando (compatibilidade)', async () => {
    await request(servidor())
      .patch('/lojas/11')
      .set('Authorization', `Bearer ${tokenDono}`)
      .send({ descricao: 'Nova descrição' })
      .expect(200);
  });

  it('PATCH por não dono é recusado', async () => {
    await request(servidor())
      .patch('/lojas/11')
      .set('Authorization', `Bearer ${tokenOutro}`)
      .send({ descricao: 'invasão' })
      .expect(404);
  });
});
