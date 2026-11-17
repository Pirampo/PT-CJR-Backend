// Banco exclusivamente em memória; arquivos somente na pasta temporária.
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import sharp from 'sharp';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configurarUploads } from '../src/uploads-static.js';

const DONO = 101;
const OUTRO = 102;
const PRODUTO = 201;
let foto: string | null;
let imagens: { id: number; produto_id: number; url_imagem: string; ordem: number }[];
let falharUsuario = false;
let falharImagem = false;
const prisma = {
  usuarios: {
    findUnique: vi.fn(async ({ where, select }) => {
      if (![DONO, OUTRO].includes(where.id)) return null;
      const usuario = { id: where.id, nome: 'Demonstração', username: 'demo', email: 'demo@example.test', foto_perfil_url: where.id === DONO ? foto : null, lojas: [] };
      return select ? Object.fromEntries(Object.entries(usuario).filter(([campo]) => select[campo])) : usuario;
    }),
    update: vi.fn(async ({ data }) => {
      if (falharUsuario) throw new Error('Banco indisponível');
      foto = data.foto_perfil_url;
      return { id: DONO, foto_perfil_url: foto };
    }),
  },
  produtos: {
    findUnique: vi.fn(async ({ where }) => where.id === PRODUTO
      ? { id: PRODUTO, loja_id: 12, lojas: { usuario_id: DONO }, imagem: imagens } : null),
  },
  imagens_Produtos: {
    aggregate: vi.fn(async () => ({ _max: { ordem: imagens.length ? Math.max(...imagens.map((i) => i.ordem)) : null } })),
    create: vi.fn(async ({ data }) => {
      if (falharImagem) throw new Error('Banco indisponível');
      const registro = { id: imagens.length + 1, ...data };
      imagens.push(registro);
      return registro;
    }),
  },
};

describe('Foto PNG do usuário e imagens de produtos (Prisma em memória)', () => {
  let app: INestApplication;
  let tokenDono: string;
  let tokenOutro: string;
  let temporario: string;
  let cwd: string;
  let png: Buffer;
  let jpeg: Buffer;

  beforeAll(async () => {
    cwd = process.cwd();
    temporario = await mkdtemp(join(tmpdir(), 'stockio-perfil-produtos-'));
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    process.chdir(temporario);
    configurarUploads(app);
    await app.init();
    const secret = app.get(ConfigService).get<string>('JWT_SECRET');
    // Tokens apenas deste app de teste, sem conexão com o banco real.
    tokenDono = await app.get(JwtService).signAsync({ sub: DONO }, { secret });
    tokenOutro = await app.get(JwtService).signAsync({ sub: OUTRO }, { secret });
    png = await sharp({ create: { width: 40, height: 20, channels: 4, background: '#6A38F380' } }).png().toBuffer();
    jpeg = await sharp(png).jpeg().toBuffer();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    foto = null; imagens = []; falharUsuario = false; falharImagem = false;
    await rm(join(temporario, 'uploads'), { recursive: true, force: true });
  });

  afterAll(async () => {
    await app?.close(); process.chdir(cwd);
    await rm(temporario, { recursive: true, force: true });
  });

  const servidor = () => app.getHttpServer();
  const enviarFoto = (arquivo = png, filename = 'foto.png', token = tokenDono) => request(servidor())
    .post(`/user/${DONO}/foto-perfil`).set('Authorization', `Bearer ${token}`).attach('foto', arquivo, filename);
  const enviarProduto = (arquivo = png, filename = 'produto.png', token = tokenDono) => request(servidor())
    .post(`/produtos/${PRODUTO}/imagens`).set('Authorization', `Bearer ${token}`).attach('imagem', arquivo, filename);

  it.each([`/user/${DONO}/foto-perfil`, `/produtos/${PRODUTO}/imagens`])('exige sessão: %s', async (url) => {
    await request(servidor()).post(url).expect(401);
  });

  it('recusa foto de outro usuário antes de atualizar ou criar arquivos', async () => {
    await enviarFoto(png, 'foto.png', tokenOutro).expect(403);
    expect(prisma.usuarios.update).not.toHaveBeenCalled();
    expect(await readdir(join(temporario, 'uploads')).catch(() => [])).toEqual([]);
  });

  it('converte PNG para WebP circularmente recortável, persiste URL e a serve com nosniff', async () => {
    const resposta = await enviarFoto().expect(201);
    expect(Object.keys(resposta.body).sort()).toEqual(['foto_perfil_url', 'id']);
    const url = resposta.body.foto_perfil_url as string;
    expect(url).toMatch(new RegExp(`/uploads/usuarios/${DONO}/[0-9a-f-]{36}\\.webp$`));
    const publico = await request(servidor()).get(`/user/${DONO}`).expect(200);
    expect(publico.body.foto_perfil_url).toBe(url);
    const privado = await request(servidor()).get('/user/me').set('Authorization', `Bearer ${tokenDono}`).expect(200);
    expect(privado.body.foto_perfil_url).toBe(url);
    const imagem = await request(servidor()).get(new URL(url).pathname).expect(200);
    expect(imagem.headers['x-content-type-options']).toBe('nosniff');
    expect(await sharp(imagem.body as Buffer).metadata()).toMatchObject({ format: 'webp', width: 512, height: 512, hasAlpha: true });
  });

  it('troca a foto somente após persistir a nova URL e remove a versão anterior', async () => {
    const antes = (await enviarFoto().expect(201)).body.foto_perfil_url as string;
    const depois = (await enviarFoto().expect(201)).body.foto_perfil_url as string;
    expect(depois).not.toBe(antes);
    await request(servidor()).get(new URL(antes).pathname).expect(404);
    await request(servidor()).get(new URL(depois).pathname).expect(200);
    expect(await readdir(join(temporario, 'uploads', 'usuarios', String(DONO)))).toHaveLength(1);
  });

  it('preserva foto anterior e remove arquivo novo quando a persistência falha', async () => {
    const anterior = (await enviarFoto().expect(201)).body.foto_perfil_url;
    falharUsuario = true;
    await enviarFoto().expect(500);
    expect(foto).toBe(anterior);
    expect(await readdir(join(temporario, 'uploads', 'usuarios', String(DONO)))).toHaveLength(1);
  });

  it('valida PNG pelo conteúdo, mesmo com extensão diferente', async () => {
    await enviarFoto(png, 'foto.jpg').expect(201);
  });

  it('recusa JPEG disfarçado de PNG', async () => {
    await enviarFoto(jpeg, 'foto.png').expect(400);
    expect(prisma.usuarios.update).not.toHaveBeenCalled();
  });

  it.each([
    Buffer.from('falso'),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  ])('recusa conteúdo inválido no upload PNG', async (arquivo) => {
    await enviarFoto(arquivo).expect(400);
    expect(prisma.usuarios.update).not.toHaveBeenCalled();
  });

  it('exige arquivo', async () => {
    await request(servidor()).post(`/user/${DONO}/foto-perfil`).set('Authorization', `Bearer ${tokenDono}`).expect(400);
  });

  it.each([['foto', `/user/${DONO}/foto-perfil`], ['imagem', `/produtos/${PRODUTO}/imagens`]])('limita %s a 2 MB', async (campo, url) => {
    await request(servidor()).post(url).set('Authorization', `Bearer ${tokenDono}`)
      .attach(campo, Buffer.alloc(2 * 1024 * 1024 + 1), 'grande.png').expect(413);
  });

  it('recusa imagem de produto de outro proprietário', async () => {
    await enviarProduto(png, 'foto.png', tokenOutro).expect(403);
    expect(prisma.imagens_Produtos.create).not.toHaveBeenCalled();
  });

  it.each(['png', 'jpeg', 'webp'] as const)('anexa imagem %s sem substituir imagens existentes e retorna na consulta pública', async (formato) => {
    const arquivo = await sharp(png).toFormat(formato).toBuffer();
    await enviarProduto(arquivo, `produto.${formato}`).expect(201);
    const resposta = await enviarProduto(arquivo, `produto.${formato}`).expect(201);
    expect(resposta.body.ordem).toBe(1);
    expect(imagens).toHaveLength(2);
    const publico = await request(servidor()).get(`/produtos/${PRODUTO}`).expect(200);
    expect(publico.body.imagem).toHaveLength(2);
    const imagem = await request(servidor()).get(new URL(resposta.body.url_imagem).pathname).expect(200);
    expect(await sharp(imagem.body as Buffer).metadata()).toMatchObject({ format: 'webp' });
  });

  it('recusa SVG no upload raster de produtos', async () => {
    await enviarProduto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')).expect(400);
    expect(imagens).toHaveLength(0);
  });

  it('remove imagem de produto se o registro falhar', async () => {
    falharImagem = true;
    await enviarProduto().expect(500);
    expect(await readdir(join(temporario, 'uploads', 'produtos', String(PRODUTO)))).toEqual([]);
  });
});
