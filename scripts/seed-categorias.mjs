// Cria no banco as categorias definidas pelo sistema que ainda não existem.
// Pode rodar mais de uma vez: nunca altera nem apaga categorias existentes.
// Uso: npm run seed:categorias
// A mesma lista existe no frontend, em app/lib/categoriasSistema.ts.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const CATEGORIAS = [
  'Mercado',
  'Farmácia',
  'Beleza',
  'Moda',
  'Eletrônicos',
  'Tecnologia',
  'Jogos',
  'Brinquedos',
  'Casa',
];

// "Farmácia", "farmacia" e "FARMÁCIA" contam como a mesma categoria.
const normalizar = (nome) =>
  nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não foi definida.');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const principais = await prisma.categorias.findMany({
    where: { categoria_pai_id: null },
  });
  const existentes = new Set(principais.map(({ nome }) => normalizar(nome)));
  const faltando = CATEGORIAS.filter((nome) => !existentes.has(normalizar(nome)));

  await prisma.categorias.createMany({
    data: faltando.map((nome) => ({ nome })),
  });
  console.log(
    faltando.length
      ? `Categorias criadas: ${faltando.join(', ')}`
      : 'Todas as categorias do sistema já existem.',
  );
} finally {
  await prisma.$disconnect();
}
