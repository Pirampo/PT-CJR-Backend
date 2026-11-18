import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import bcrypt from 'bcrypt';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const senhaHash = await bcrypt.hash('senha-somente-do-teste', 4);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        usuarios: {
          findUnique: async ({ where }) =>
            where.email === 'app@example.test'
              ? { id: 101, email: where.email, senha_hash: senhaHash }
              : null,
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('protege a raiz sem sessão', () => {
    return request(app.getHttpServer()).get('/').expect(401);
  });

  it('mantém a raiz e /me após login legítimo', async () => {
    const login = await request(app.getHttpServer())
      .post('/login')
      .send({ email: 'app@example.test', senha: 'senha-somente-do-teste' })
      .expect(200);
    const token = login.body.access_token;
    await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.sub).toBe(101);
      });
    return request(app.getHttpServer())
      .get('/')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Hello World!');
  });

  afterAll(async () => {
    await app?.close();
  });
});
