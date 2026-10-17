import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
<<<<<<< HEAD
import { TaskModule } from './task/task.module.js';
=======
import { UserModule } from './user/user.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PostModule } from './post/post.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard.js';
>>>>>>> origin/autenticacao

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY!,
      appSecret: process.env.OBSERVE_APP_SECRET!,
      serviceId: 'backend_1',
    }),
    UserModule,
    PostModule,
    AuthModule,
    JwtModule,
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        const jwtSecret = config.JWT_SECRET;

        if (typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
          throw new Error(
            'JWT_SECRET deve estar definida e ter ao menos 32 caracteres.',
          );
        }

        return config;
      },
    }),
    TaskModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD, // acessa o auth.guard para que ele proteja todas as rotas existentes na aplicacao
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
