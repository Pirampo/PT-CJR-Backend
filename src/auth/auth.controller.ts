import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginRequestBody } from './dto/loginRequestBody.dto.js';
import { Public } from './decorators/isPublic.decorator.js';
import type { AuthenticatedRequest, UserPayload } from './types.js';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // passando como parametro a validacao no dto com as informacoes passadas no corpo da requisicao
  login(@Body() LoginRequestBody: LoginRequestBody) {
    return this.authService.login(LoginRequestBody);
  }

  @Get('me')
  getProfile(@Request() request: AuthenticatedRequest): UserPayload {
    return request.user;
  }
}
