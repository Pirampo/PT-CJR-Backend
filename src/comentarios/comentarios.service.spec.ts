import { Test, TestingModule } from '@nestjs/testing';
import { ComentariosService } from './comentarios.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ComentariosService', () => {
  let service: ComentariosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComentariosService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ComentariosService>(ComentariosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
