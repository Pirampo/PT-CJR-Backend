import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service.js';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginRequestBody } from './dto/loginRequestBody.dto.js';
// notion nao diz que precisa criar um arquivo para essa importacao abaixo
import { UserToken, UserPayload } from './types.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginRequestBody: LoginRequestBody): Promise<UserToken> {
    const isUserValid = await this.validateUser(
      loginRequestBody.email,
      loginRequestBody.senha,
    );

    if (!isUserValid) {
      throw new UnauthorizedException('Usuário ou senha incorretos');
    }

    const payload: UserPayload = {
      sub: isUserValid.id,
      email: loginRequestBody.email,
    };

    const jwtSecret = this.configService.get<string>('JWT_SECRET');

    const jwtToken = await this.jwtService.signAsync(payload, {
      expiresIn: '1d',
      secret: jwtSecret,
    });

    return {
      access_token: jwtToken,
    };
  }

  async validateUser(email: string, senha: string) {
    const user = await this.userService.findByEmail(email);

    if (user) {
      const isPasswordValid = await bcrypt.compare(senha, user.senha_hash);

      if (isPasswordValid) {
        return {
          ...user,
          senha: undefined,
        };
      }
    }
    return null;
  }
}
