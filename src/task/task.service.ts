import { Injectable } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class TaskService {

  constructor (private prisma: PrismaService){}
  create(data: taskdto) {
   
  }

}
