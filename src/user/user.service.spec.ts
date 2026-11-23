import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const prisma = { usuarios: { findUnique: vi.fn() } };

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('perfil público não seleciona e-mail nem senha', async () => {
    prisma.usuarios.findUnique.mockResolvedValue({ id: 6, nome: 'Dono', username: 'dono', foto_perfil_url: null, lojas: [] });
    await service.findPublicProfile(6);
    const { select } = prisma.usuarios.findUnique.mock.calls[0][0];
    expect(select).not.toHaveProperty('email');
    expect(select).not.toHaveProperty('senha_hash');
    expect(select).toMatchObject({ id: true, nome: true, username: true, foto_perfil_url: true });
  });

  it.each(['dono@exemplo.com', 'nome+alias@exemplo.com', 'dono @exemplo.com', 'nome＠exemplo.com'])('omite username privado: %s', async (username) => {
    prisma.usuarios.findUnique.mockResolvedValue({ id: 6, nome: 'Nome Público', username, lojas: [] });
    await expect(service.findPublicProfile(6)).resolves.toMatchObject({ nome: 'Nome Público', username: null });
  });

  it('preserva identificador público simples', async () => {
    prisma.usuarios.findUnique.mockResolvedValue({ id: 6, nome: 'Nome Público', username: 'dono_6.teste-01', lojas: [] });
    await expect(service.findPublicProfile(6)).resolves.toMatchObject({ username: 'dono_6.teste-01' });
  });
});
