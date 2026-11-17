import { randomBytes } from 'node:crypto';
import { configurarDemo, executarDemo, prepararDados } from './seed-demo.mjs';

const env = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://teste@localhost:5432/banco_atual',
  DEMO_DATABASE_URL: 'postgresql://teste@localhost:55473/stockio_demo',
  DEMO_DATABASE_CONFIRM: 'stockio_demo',
  DEMO_ADMIN_PASSWORD: randomBytes(24).toString('hex'),
};

describe('seed:demo — proteções e conflitos sem conexão com banco', () => {
  it('aceita destino local isolado e confirmado', () => {
    expect(configurarDemo(env)).toMatchObject({
      databaseName: 'stockio_demo',
      port: '55473',
      publicUrl: 'http://localhost:3001',
    });
  });

  it.each([
    { NODE_ENV: 'production' },
    { APP_ENV: 'production' },
    { DEMO_DATABASE_URL: undefined },
    { DEMO_DATABASE_CONFIRM: 'outro' },
    { DEMO_ADMIN_PASSWORD: '' },
    { DEMO_ADMIN_PASSWORD: 'x'.repeat(73) },
    { DEMO_ADMIN_PASSWORD: 'ç'.repeat(37) },
    { DEMO_DATABASE_URL: 'postgresql://teste@remoto.example/stockio_demo' },
    {
      DEMO_DATABASE_URL:
        'postgresql://teste@localhost/stockio_demo?host=remoto.example',
    },
    {
      DEMO_DATABASE_URL:
        'postgresql://teste@localhost/stockio_demo?schema=privado',
    },
    {
      DEMO_DATABASE_URL: 'postgresql://teste@localhost/postgres',
      DEMO_DATABASE_CONFIRM: 'postgres',
    },
    {
      DEMO_DATABASE_URL: 'postgresql://teste@127.0.0.1:5432/banco_atual',
      DEMO_DATABASE_CONFIRM: 'banco_atual',
    },
    { BACKEND_PUBLIC_URL: 'http://usuario:segredo@localhost:3001' },
    { BACKEND_PUBLIC_URL: 'http://localhost:3001/uploads' },
    { BACKEND_PUBLIC_URL: 'https://externo.example' },
  ])('recusa configuração insegura sem conectar %#', (mudanca) => {
    expect(() => configurarDemo({ ...env, ...mudanca })).toThrow();
  });

  it('mantém dados públicos fictícios e oito imagens locais distintas', async () => {
    const dados = await prepararDados();
    expect(dados.manifesto.produtos).toHaveLength(8);
    expect(dados.manifesto.avaliacoes.reduce((n, a) => n + a.nota, 0) / 5).toBe(
      4.6,
    );
    expect(new Set(dados.imagens.map((i) => i.hash)).size).toBe(8);
    expect(dados.manifesto.administrador).toEqual({
      nome: 'Administrador Sabor da Vila',
      username: 'admin_sabor_vila',
      email: 'admin.sabor.vila@example.com',
    });
    expect(JSON.stringify(dados.manifesto)).not.toMatch(
      /usuario_id|senha_hash|"senha"|"id"/,
    );
  });

  it('não adota loja preexistente que não foi criada pelo seed', async () => {
    const tx = {
      $queryRaw: vi.fn(),
      lojas: {
        findUnique: vi.fn().mockResolvedValue({
          descricao: 'Loja existente',
          produtos: [],
          avaliacoes_loja: [],
        }),
      },
    };
    const prisma = { $transaction: vi.fn(async (fn) => fn(tx)) };
    await expect(
      executarDemo({
        prisma,
        config: configurarDemo(env),
        dados: await prepararDados(),
      }),
    ).rejects.toThrow(/sem marca/);
  });

  it('interrompe antes de criar qualquer registro se username ou e-mail já existe sem origem do seed', async () => {
    const tx = {
      $queryRaw: vi.fn(),
      lojas: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      usuarios: {
        findFirst: vi.fn().mockResolvedValue({ id: 999 }),
        create: vi.fn(),
      },
    };
    const prisma = { $transaction: vi.fn(async (fn) => fn(tx)) };
    await expect(
      executarDemo({
        prisma,
        config: configurarDemo(env),
        dados: await prepararDados(),
      }),
    ).rejects.toThrow(/origem comprovada/);
    expect(tx.usuarios.create).not.toHaveBeenCalled();
    expect(tx.lojas.create).not.toHaveBeenCalled();
  });
});
