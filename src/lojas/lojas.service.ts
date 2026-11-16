import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateLojaDto } from './dto/create-loja.dto.js';
import { UpdateLojaDto } from './dto/update-loja.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import sharp, { type Sharp, type Metadata } from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

@Injectable()
export class LojasService {
  constructor(private readonly prisma: PrismaService) { }
  create(createLojaDto: CreateLojaDto, usuarioId: number) {
    return this.prisma.lojas.create({
      data: {
        ...createLojaDto,
        usuario_id: usuarioId,
      },
    });
  }


  async adicionarBanner(
    lojaId: number,
    usuarioId: number,
    arquivo: Express.Multer.File | undefined,
  ) {
    // 1. Verificar se a loja existe
    const loja = await this.prisma.lojas.findUnique({
      where: { id: lojaId },
    });

    if (!loja) {
      throw new NotFoundException('Loja não encontrada.');
    }

    // 2. Verificar se pertence ao usuário autenticado
    if (loja.usuario_id !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar esta loja.',
      );
    }

    // 3. Verificar se um arquivo foi recebido
    if (!arquivo || !arquivo.buffer?.length) {
      throw new BadRequestException('Envie uma imagem de banner.');
    }

    const limite = 10 * 1024 * 1024;

    if (arquivo.size > limite) {
      throw new BadRequestException(
        'O banner deve ter no máximo 10 MB.',
      );
    }

    // 4. Validar o conteúdo real da imagem
    let imagem: Sharp;
    let metadados: Metadata;

    try {
      imagem = sharp(arquivo.buffer, {
        limitInputPixels: 40_000_000,
      });

      metadados = await imagem.metadata();
    } catch {
      throw new BadRequestException('Arquivo de imagem inválido.');
    }

    if (
      !metadados.format ||
      !['jpeg', 'png', 'webp'].includes(metadados.format)
    ) {
      throw new BadRequestException(
        'Formatos permitidos: JPG, PNG e WebP.',
      );
    }

    // 5. Converter e normalizar a imagem
    let conteudo: Buffer;

    try {
      conteudo = await imagem
        .rotate()
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'Não foi possível processar o banner.',
      );
    }

    // 6. Criar um nome e diretório seguros
    const nomeArquivo = `${randomUUID()}.webp`;

    const diretorio = join(
      process.cwd(),
      'uploads',
      'lojas',
      String(lojaId),
    );

    await mkdir(diretorio, { recursive: true });

    const caminhoArquivo = join(diretorio, nomeArquivo);

    // 7. Armazenar o arquivo localmente
    await writeFile(caminhoArquivo, conteudo);

    const bannerUrl =
      `http://localhost:3001/uploads/lojas/${lojaId}/${nomeArquivo}`;

    // 8. Atualizar o banco de dados
    try {
      return await this.prisma.lojas.update({
        where: { id: lojaId },
        data: { banner_url: bannerUrl },
      });
    } catch (erro) {
      // Evita deixar arquivo novo sem referência no banco
      await unlink(caminhoArquivo).catch(() => undefined);
      throw erro;
    }
  }


  findAll() {
    return this.prisma.lojas.findMany();
  }


  async findOne(id: number) {
    const loja = await this.prisma.lojas.findUnique({
      where: { id },
    });

    if (!loja) {
      throw new NotFoundException(
        `Loja com ID ${id} não encontrada!`,
      );
    }

    return loja;
  }


  async update(id: number, usuarioId: number, updateLojaDto: UpdateLojaDto) {
    // verifica se o usuario cadastrou a loja
    const loja = await this.prisma.lojas.findFirst({
      where: {
        id,
        usuario_id: usuarioId,
      },
    });
    if (!loja) {
      throw new NotFoundException(
        'Esta loja não foi cadastrada por este usuário.',
      );
    }

    // verifica se o nome passado é o mesmo nome de outra loja
    if (updateLojaDto.nome && updateLojaDto.nome !== loja.nome) {
      const outraLojaComMesmoNome = await this.prisma.lojas.findUnique({
        where: { nome: updateLojaDto.nome },
      });
      if (outraLojaComMesmoNome) {
        throw new ConflictException('Nome da loja já está sendo usado.');
      }
    }
    // se passar em todos os teste, atualize:
    const dados = { ...updateLojaDto };
    return this.prisma.lojas.update({
      where: { id },
      data: {
        ...dados,
      },
      select: {
        id: true,
        nome: true,
      },
    });
  }

  async remove(id: number, usuarioId: number) {

    const loja = await this.prisma.lojas.findFirst({
      where: {
        id,
        usuario_id: usuarioId,
      },
    });

    if (!loja) {
      throw new NotFoundException(
        'Esta loja não foi cadastrada por este usuário.',
      );
    }

    return await this.prisma.lojas.delete({
      where: { id },
      select: {
        id: true,
        usuario_id: true,
        nome: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

}
