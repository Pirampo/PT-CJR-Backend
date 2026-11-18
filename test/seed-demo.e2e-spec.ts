// Opcional: exige um PostgreSQL descartável, separado do DATABASE_URL.
// Nenhuma limpeza de banco, migration ou exclusão de registros é executada.
import { randomBytes } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  readdir,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import sharp from 'sharp';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configurarUploads } from '../src/uploads-static.js';
import {
  configurarDemo,
  criarClienteDemo,
  executarDemo,
  prepararDados,
} from '../scripts/seed-demo.mjs';

describe.skipIf(!process.env.DEMO_TEST_DATABASE_URL)(
  'seed:demo em PostgreSQL isolado',
  () => {
    let config;
    let prisma;
    let dados;
    let resultado;
    let uploadsRoot: string;
    let raizTeste: string;
    let app: INestApplication;
    let independente;

    async function estado() {
      const tabelas = [
        'usuarios',
        'lojas',
        'categorias',
        'produtos',
        'imagens_Produtos',
        'avaliacoes_Loja',
      ];
      return JSON.stringify(
        await Promise.all(
          tabelas.map((t) => prisma[t].findMany({ orderBy: { id: 'asc' } })),
        ),
      );
    }

    beforeAll(async () => {
      config = configurarDemo({
        ...process.env,
        NODE_ENV: 'test',
        DEMO_DATABASE_URL: process.env.DEMO_TEST_DATABASE_URL,
        DEMO_DATABASE_CONFIRM: new URL(
          process.env.DEMO_TEST_DATABASE_URL!,
        ).pathname.slice(1),
        DEMO_ADMIN_PASSWORD: randomBytes(24).toString('hex'),
        BACKEND_PUBLIC_URL: 'http://localhost:3101',
      });
      prisma = criarClienteDemo(config);
      // Impede que o teste seja usado para esvaziar ou reaproveitar uma base.
      if ((await prisma.usuarios.count()) || (await prisma.lojas.count()))
        throw new Error('O teste exige banco isolado com schema e sem dados.');
      raizTeste = await mkdtemp(join(tmpdir(), 'stockio-seed-uploads-'));
      uploadsRoot = join(raizTeste, 'uploads');
      dados = await prepararDados();
      const usuario = await prisma.usuarios.create({
        data: {
          nome: 'Usuário independente de teste',
          username: 'independente_seed_test',
          email: 'independente@example.test',
          senha_hash: await bcrypt.hash(randomBytes(24).toString('hex'), 10),
        },
      });
      const categoria = await prisma.categorias.create({
        data: { nome: 'Categoria independente' },
      });
      const loja = await prisma.lojas.create({
        data: {
          nome: 'Loja independente de teste',
          usuario_id: usuario.id,
          categoria_id: categoria.id,
        },
      });
      independente = { usuario, categoria, loja };
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
      const cwd = process.cwd();
      process.chdir(raizTeste);
      try {
        configurarUploads(app);
      } finally {
        process.chdir(cwd);
      }
      await app.init();
    });

    afterAll(async () => {
      if (resultado && process.env.DEMO_TEST_RESULT_FILE)
        await writeFile(
          process.env.DEMO_TEST_RESULT_FILE,
          JSON.stringify({ ...resultado, uploadsRoot, raizTeste }, null, 2),
        );
      await app?.close();
      await prisma?.$disconnect();
    });

    it('cria o conjunto com IDs atribuídos pelo PostgreSQL e preserva dados independentes', async () => {
      resultado = await executarDemo({ prisma, config, dados, uploadsRoot });
      expect(resultado.criado).toBe(true);
      expect(resultado.usuarioId).not.toBe(independente.usuario.id);
      expect(resultado.lojaId).not.toBe(independente.loja.id);
      expect(resultado.produtos).toHaveLength(8);
      expect(resultado.avaliacoes).toHaveLength(5);
      expect(
        await prisma.usuarios.findUnique({
          where: { id: independente.usuario.id },
        }),
      ).toEqual(independente.usuario);
      expect(
        await prisma.lojas.findUnique({ where: { id: independente.loja.id } }),
      ).toEqual(independente.loja);
      const admin = await prisma.usuarios.findUnique({
        where: { id: resultado.usuarioId },
      });
      expect(admin.senha_hash).not.toBe(config.password);
      expect(await bcrypt.compare(config.password, admin.senha_hash)).toBe(
        true,
      );
    });

    it('autentica o administrador no endpoint real sem fabricar tokens', async () => {
      const login = await request(app.getHttpServer())
        .post('/login')
        .send({
          email: dados.manifesto.administrador.email,
          senha: config.password,
        })
        .expect(200);
      const sessao = await request(app.getHttpServer())
        .get('/user/me')
        .set('Authorization', `Bearer ${login.body.access_token}`)
        .expect(200);
      expect(sessao.body.id).toBe(resultado.usuarioId);
    });

    it('serve oito produtos, imagens WebP distintas e cinco avaliações públicas com média 4,60', async () => {
      const loja = (
        await request(app.getHttpServer())
          .get(`/lojas/${resultado.lojaId}`)
          .expect(200)
      ).body;
      expect(loja.produtos).toHaveLength(8);
      expect(loja.avaliacoes_loja).toHaveLength(5);
      expect(loja.media_avaliacoes).toBe(4.6);
      expect(
        new Set(loja.avaliacoes_loja.map((a) => a.usuario_id ?? a.usuario.id))
          .size,
      ).toBe(5);
      expect(
        loja.avaliacoes_loja.every((a) => a.usuario.id !== resultado.usuarioId),
      ).toBe(true);
      for (const produto of loja.produtos) {
        expect(produto.imagem).toHaveLength(1);
        const imagem = await request(app.getHttpServer())
          .get(new URL(produto.imagem[0].url_imagem).pathname)
          .expect(200);
        expect(imagem.headers['x-content-type-options']).toBe('nosniff');
        expect((await sharp(imagem.body).metadata()).format).toBe('webp');
      }
    });

    it('segunda execução mantém IDs, hashes e conteúdo de todos os registros', async () => {
      const antes = await estado();
      const segundo = await executarDemo({
        prisma,
        config,
        dados,
        uploadsRoot,
      });
      expect(segundo).toEqual({ ...resultado, criado: false });
      expect(await estado()).toBe(antes);
      expect(await prisma.usuarios.count()).toBe(7); // Um independente + seis fictícios.
    });

    it('senha divergente é conflito e não redefine credenciais', async () => {
      const antes = await estado();
      await expect(
        executarDemo({
          prisma,
          config: { ...config, password: randomBytes(24).toString('hex') },
          dados,
          uploadsRoot,
        }),
      ).rejects.toThrow(/senha não foi alterada/);
      expect(await estado()).toBe(antes);
    });

    it('não adota nem sobrescreve loja com marca de origem ausente', async () => {
      const original = await prisma.lojas.findUnique({
        where: { id: resultado.lojaId },
      });
      await prisma.lojas.update({
        where: { id: original.id },
        data: { descricao: 'Registro sem origem do seed' },
      });
      const antes = await estado();
      await expect(
        executarDemo({ prisma, config, dados, uploadsRoot }),
      ).rejects.toThrow(/sem marca/);
      expect(await estado()).toBe(antes);
      await prisma.lojas.update({
        where: { id: original.id },
        data: { descricao: original.descricao },
      });
    });

    it('recusa sobrescrever um produto editado, mesmo sendo do próprio seed', async () => {
      const original = await prisma.produtos.findUnique({
        where: { id: resultado.produtos[0].id },
      });
      await prisma.produtos.update({
        where: { id: original.id },
        data: { estoque: original.estoque + 1 },
      });
      const antes = await estado();
      await expect(
        executarDemo({ prisma, config, dados, uploadsRoot }),
      ).rejects.toThrow(/Conflito no produto/);
      expect(await estado()).toBe(antes);
      await prisma.produtos.update({
        where: { id: original.id },
        data: { estoque: original.estoque },
      });
    });

    it('restaura arquivo ausente do próprio seed sem regravar registros', async () => {
      const imagem = await prisma.imagens_Produtos.findUnique({
        where: { id: resultado.produtos[0].imagemId },
      });
      const caminho = join(
        uploadsRoot,
        new URL(imagem.url_imagem).pathname.slice('/uploads/'.length),
      );
      const original = await readFile(caminho);
      await unlink(caminho); // Somente arquivo gerado dentro do teste isolado.
      const antes = await estado();
      await executarDemo({ prisma, config, dados, uploadsRoot });
      expect(await readFile(caminho)).toEqual(original);
      expect(await estado()).toBe(antes);
    });

    it('falha tardia faz rollback dos novos registros e remove apenas arquivos da tentativa', async () => {
      const antes = await estado();
      const copia = structuredClone(dados.manifesto);
      copia.loja = 'Demonstração de rollback isolado';
      copia.administrador = {
        nome: 'Teste de rollback',
        username: 'rollback_admin',
        email: 'rollback_admin@example.test',
      };
      copia.avaliacoes.forEach((a, i) => {
        a.usuario.username = `rollback_${i}`;
        a.usuario.email = `rollback_${i}@example.test`;
      });
      copia.produtos[7].nome = 'X'.repeat(300); // PostgreSQL rejeita varchar(255).
      await expect(
        executarDemo({
          prisma,
          config,
          dados: { ...dados, manifesto: copia },
          uploadsRoot,
        }),
      ).rejects.toThrow();
      expect(await estado()).toBe(antes);
      const arquivos = [];
      for (const pasta of await readdir(join(uploadsRoot, 'produtos'))) {
        arquivos.push(...(await readdir(join(uploadsRoot, 'produtos', pasta))));
      }
      expect(arquivos).toHaveLength(8);
    });
  },
);
