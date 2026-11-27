import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedRequest } from './types.js';

// Libera a rota apenas para os e-mails listados em ADMIN_EMAILS (separados por vírgula).
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const email = request.user?.email?.trim().toLowerCase();
    const admins = (this.configService.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (!email || !admins.includes(email)) {
      throw new ForbiddenException(
        'Apenas administradores podem alterar categorias.',
      );
    }
    return true;
  }
}
