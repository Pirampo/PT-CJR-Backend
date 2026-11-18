import { Test, TestingModule } from '@nestjs/testing';
import { LojasController } from './lojas.controller.js';
import { LojasService } from './lojas.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('LojasController', () => {
  let controller: LojasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LojasController],
      providers: [LojasService, { provide: PrismaService, useValue: {} }],
    }).compile();

    controller = module.get<LojasController>(LojasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
