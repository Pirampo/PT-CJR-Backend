import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const prisma = { usuarios: { findUnique: vi.fn(), update: vi.fn() } };

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

  describe('alteração de senha', () => {
    beforeEach(async () => {
      prisma.usuarios.update.mockReset().mockResolvedValue({ id: 6 });
      prisma.usuarios.findUnique.mockResolvedValue({
        id: 6, email: 'dono@x.com', username: 'dono', senha_hash: await bcrypt.hash('antiga1', 4),
      });
    });

    it.each([
      ['sem a senha antiga', undefined, 'Informe a senha antiga'],
      ['com a senha antiga errada', 'errada1', 'A senha antiga está incorreta'],
    ])('recusa %s', async (_, senha_antiga, mensagem) => {
      await expect(service.update(6, { senha: 'nova123', senha_antiga })).rejects.toThrow(mensagem);
      expect(prisma.usuarios.update).not.toHaveBeenCalled();
    });

    it('grava apenas o hash da nova senha', async () => {
      await service.update(6, { senha: 'nova123', senha_antiga: 'antiga1' });
      const { data } = prisma.usuarios.update.mock.calls[0][0];
      expect(Object.keys(data)).toEqual(['senha_hash']);
      expect(await bcrypt.compare('nova123', data.senha_hash)).toBe(true);
    });

    it('não exige senha para editar os outros campos', async () => {
      await service.update(6, { nome: 'Novo' });
      expect(prisma.usuarios.update.mock.calls[0][0].data).toEqual({ nome: 'Novo' });
    });
  });
});
