import { UserService } from '../user/user.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const buscarEmail = vi.fn();
  const atualizarSenha = vi.fn();
  let jwt: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: { findByEmail: buscarEmail, atualizarSenha },
        },
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: () => 'chave-exclusiva-do-teste-unitario-com-32-caracteres',
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    buscarEmail.mockReset();
    atualizarSenha.mockReset();
    jwt = module.get(JwtService);
  });

  it('recusa usuário inexistente e senha incorreta', async () => {
    buscarEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'demo@example.test', senha: 'errada' }),
    ).rejects.toMatchObject({ status: 401 });
    buscarEmail.mockResolvedValue({
      id: 101,
      senha_hash: await bcrypt.hash('correta', 4),
    } as Awaited<ReturnType<UserService['findByEmail']>>);
    await expect(
      service.login({ email: 'demo@example.test', senha: 'errada' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('valida bcrypt e emite JWT com sub e expiração', async () => {
    buscarEmail.mockResolvedValue({
      id: 101,
      senha_hash: await bcrypt.hash('correta', 4),
    } as Awaited<ReturnType<UserService['findByEmail']>>);
    const resultado = await service.login({
      email: 'demo@example.test',
      senha: 'correta',
    });
    const payload = await jwt.verifyAsync(resultado.access_token, {
      secret: 'chave-exclusiva-do-teste-unitario-com-32-caracteres',
    });
    expect(payload).toMatchObject({ sub: 101, email: 'demo@example.test' });
    expect(payload.exp - payload.iat).toBe(86400);
    expect(payload).not.toHaveProperty('senha_hash');
  });

  it('troca a senha quando a senha atual confere', async () => {
    buscarEmail.mockResolvedValue({
      id: 7,
      senha_hash: await bcrypt.hash('antiga1', 4),
    } as Awaited<ReturnType<UserService['findByEmail']>>);

    await expect(
      service.trocarSenha({
        email: 'demo@example.test',
        senha_atual: 'antiga1',
        nova_senha: 'novinha1',
      }),
    ).resolves.toEqual({ mensagem: 'Senha alterada com sucesso.' });
    expect(atualizarSenha).toHaveBeenCalledWith(7, 'novinha1');
  });

  it('não troca a senha com a senha atual errada', async () => {
    buscarEmail.mockResolvedValue({
      id: 7,
      senha_hash: await bcrypt.hash('antiga1', 4),
    } as Awaited<ReturnType<UserService['findByEmail']>>);

    await expect(
      service.trocarSenha({
        email: 'demo@example.test',
        senha_atual: 'errada1',
        nova_senha: 'novinha1',
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(atualizarSenha).not.toHaveBeenCalled();
  });

  it('exige nova senha diferente da atual', async () => {
    buscarEmail.mockResolvedValue({
      id: 7,
      senha_hash: await bcrypt.hash('antiga1', 4),
    } as Awaited<ReturnType<UserService['findByEmail']>>);

    await expect(
      service.trocarSenha({
        email: 'demo@example.test',
        senha_atual: 'antiga1',
        nova_senha: 'antiga1',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(atualizarSenha).not.toHaveBeenCalled();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
