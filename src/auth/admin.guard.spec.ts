import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminGuard } from './admin.guard.js';

function contexto(email?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: email ? { sub: 1, email } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

function guardCom(adminEmails?: string) {
  const config = { get: vi.fn().mockReturnValue(adminEmails) };
  return new AdminGuard(config as unknown as ConfigService);
}

describe('AdminGuard', () => {
  it('libera e-mail listado em ADMIN_EMAILS, sem diferenciar maiúsculas', () => {
    const guard = guardCom(' outro@x.com , Admin@Stock.io ');
    expect(guard.canActivate(contexto('admin@stock.io'))).toBe(true);
  });

  it('bloqueia usuário comum', () => {
    const guard = guardCom('admin@stock.io');
    expect(() => guard.canActivate(contexto('comum@stock.io'))).toThrow(
      ForbiddenException,
    );
  });

  it('bloqueia todos quando ADMIN_EMAILS não está configurado', () => {
    const guard = guardCom(undefined);
    expect(() => guard.canActivate(contexto('admin@stock.io'))).toThrow(
      ForbiddenException,
    );
  });

  it('bloqueia requisição sem usuário', () => {
    const guard = guardCom('admin@stock.io');
    expect(() => guard.canActivate(contexto())).toThrow(ForbiddenException);
  });
});
