import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { converterImagem, gravarImagem, removerArquivo, removerFotoAnterior } from '../imagens/arquivo-imagem.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async atualizarFoto(id: number, arquivo: Express.Multer.File | undefined) {
    const usuario = await this.prisma.usuarios.findUnique({
      where: { id }, select: { id: true, foto_perfil_url: true },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado.');
    const conteudo = await converterImagem(arquivo, true);
    const imagem = await gravarImagem('usuarios', id, conteudo);
    let atualizado;
    try {
      atualizado = await this.prisma.usuarios.update({
        where: { id }, data: { foto_perfil_url: imagem.url },
        select: { id: true, foto_perfil_url: true },
      });
    } catch (erro) {
      await removerArquivo(imagem.caminho);
      throw erro;
    }
    await removerFotoAnterior(id, usuario.foto_perfil_url);
    return atualizado;
  }

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

  // Dados públicos do usuário: não inclui e-mail nem senha.
  async findPublicProfile(id: number) {
    const user = await this.prisma.usuarios.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        username: true,
        foto_perfil_url: true,
        lojas: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            nome: true,
            foto_perfil_url: true,
            logo_url: true,
            banner_url: true,
            categoria: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario com ID ${id} não encontrado!`);
    }

    return {
      ...user,
      // Apenas identificadores simples são públicos. Dados legados com
      // formato de e-mail permanecem privados, sem alterar o banco.
      username: /^[A-Za-z0-9_.-]+$/.test(user.username) ? user.username : null,
    };
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
        createdAt: true,
        updatedAt: true,
      },
    });
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
        nome: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
