import type { INestApplication } from '@nestjs/common';
import { static as serveStatic } from 'express';
import { join } from 'node:path';

// Publica os arquivos enviados (somente imagens WebP geradas pelo backend).
// nosniff impede que o navegador interprete o arquivo como outro tipo.
export function configurarUploads(app: INestApplication) {
  app.use(
    '/uploads',
    serveStatic(join(process.cwd(), 'uploads'), {
      dotfiles: 'deny',
      index: false,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );
}
