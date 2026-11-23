import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { removerImagem } from '../imagens/remover-imagem.js';
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.usuarios.findUnique({
      where: { email: createUserDto.email },
    });
    if (existingUser) {
      throw new ConflictException('Este e-mail já está sendo usado.');
    }

    const mesmoUsername = await this.prisma.usuarios.findUnique({
      where: { username: createUserDto.username },
    });
    if (mesmoUsername) {
      throw new ConflictException('Este username já está sendo utilizado.');
    }
    const mesmoEmail = await this.prisma.usuarios.findUnique({
      where: { email: createUserDto.email },
    });
    if (mesmoEmail) {
      throw new ConflictException('Este Email já está sendo utilizado.');
    }

    const { senha, ...userData } = createUserDto;
    const hashedPassword = await bcrypt.hash(senha, 10);

    return await this.prisma.usuarios.create({
      data: {
        ...userData,
        senha_hash: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        nome: true,
        email: true,
        foto_perfil_url: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll() {
    return await this.prisma.usuarios.findMany({
      select: {
        id: true,
        email: true,
        nome: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.usuarios.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nome: true,
        username: true,
        foto_perfil_url: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario com ID ${id} não encontrado!`);
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.usuarios.findUnique({ where: { email } });

    if (!user) {
      return null;
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.usuarios.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`Usuario com ID ${id} não encontrado!`);
    }
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.prisma.usuarios.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Este e-mail já está sendo usado.');
      }
    }

    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUsername = await this.prisma.usuarios.findUnique({
        where: { username: updateUserDto.username },
      });

      if (existingUsername) {
        throw new ConflictException('Este username já está sendo usado.');
      }
    }

    const { senha, ...dados } = updateUserDto;

    return this.prisma.usuarios.update({
      where: { id },
      data: {
        ...dados,
        ...(senha ? { senha_hash: await bcrypt.hash(senha, 10) } : {}),
      },
      select: {
        id: true,
        email: true,
        nome: true,
        foto_perfil_url: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async atualizarFoto(id: number, file: { buffer: Buffer; mimetype: string }) {
    const user = await this.prisma.usuarios.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`Usuário com ID ${id} não encontrado.`);
    }

    const extensao = file.mimetype.split('/')[1];
    const nomeArquivo = `${randomUUID()}.${extensao}`;

    const pasta = join(process.cwd(), 'uploads', 'usuarios');
    await mkdir(pasta, { recursive: true });
    await writeFile(join(pasta, nomeArquivo), file.buffer);

    const atualizado = await this.prisma.usuarios.update({
      where: { id },
      data: { foto_perfil_url: `/uploads/usuarios/${nomeArquivo}` },
      select: { id: true, foto_perfil_url: true },
    });

    // apaga a foto antiga, se nenhum outro usuário estiver usando
    const emUso = await this.prisma.usuarios.count({
      where: { foto_perfil_url: user.foto_perfil_url },
    });
    if (emUso === 0) {
      await removerImagem('usuarios', user.foto_perfil_url);
    }

    return atualizado;
  }

  async remove(id: number) {
    const user = await this.prisma.usuarios.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return await this.prisma.usuarios.delete({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        nome: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
