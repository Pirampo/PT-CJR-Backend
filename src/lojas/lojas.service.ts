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
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { SvgInvalidoError, validarSvgSeguro } from './svg-seguro.js';

// Colunas de imagem que só podem ser preenchidas pelos endpoints de upload.
type CampoImagem = 'banner_url' | 'foto_perfil_url' | 'logo_url';
const CAMPOS_URL_IMAGEM = ['logo_url', 'banner_url', 'sticker_url'] as const;

const LIMITE_IMAGEM = 10 * 1024 * 1024;
const LIMITE_LOGO = 2 * 1024 * 1024;

// Só encaminha candidatos raster ao decodificador antes da validação SVG.
// A assinatura não basta para aceitar: abrirImagemRaster verifica o formato
// real e a conversão abaixo exige que o conteúdo possa ser decodificado.
function temAssinaturaRaster(buffer: Buffer) {
  return (
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
    (buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP')
  );
}

function urlPublicaBackend() {
  return (process.env.BACKEND_PUBLIC_URL ?? process.env.BACKEND_URL ?? 'http://localhost:3001').replace(
    /\/+$/,
    '',
  );
}

function diretorioUploads() {
  return resolve(process.cwd(), 'uploads');
}

function media(notas: { nota: number }[]) {
  if (notas.length === 0) return null;
  const soma = notas.reduce((total, { nota }) => total + nota, 0);
  return Math.round((soma / notas.length) * 100) / 100;
}

@Injectable()
export class LojasService {
  constructor(private readonly prisma: PrismaService) { }

  create(createLojaDto: CreateLojaDto, usuarioId: number) {
    // As imagens são enviadas pelos endpoints /lojas/:id/imagens/*,
    // que validam e convertem os arquivos. URLs livres não são aceitas.
    for (const campo of CAMPOS_URL_IMAGEM) {
      if (createLojaDto[campo]) {
        throw new BadRequestException(
          `O campo ${campo} não pode ser definido na criação. ` +
          'Use os endpoints /lojas/:id/imagens/* para enviar imagens.',
        );
      }
    }

    return this.prisma.lojas.create({
      data: {
        ...createLojaDto,
        usuario_id: usuarioId,
      },
    });
  }
  async findByUser(userId: number) {
    const lojas_associadas = await this.prisma.lojas.findMany({
      where: { usuario_id: userId },
    });
    if (lojas_associadas.length === 0) {
      return 'Nenhuma loja cadastrada por você.';
    }

    return lojas_associadas;
  }

  // ---------------------------------------------------------------------
  // Upload de imagens
  // ---------------------------------------------------------------------

  private async buscarLojaDoUsuario(lojaId: number, usuarioId: number) {
    const loja = await this.prisma.lojas.findUnique({
      where: { id: lojaId },
    });

    if (!loja) {
      throw new NotFoundException('Loja não encontrada.');
    }

    if (loja.usuario_id !== usuarioId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar esta loja.',
      );
    }

    return loja;
  }

  private exigirArquivo(
    arquivo: Express.Multer.File | undefined,
    descricao: string,
    limite: number,
  ): Express.Multer.File {
    if (!arquivo || !arquivo.buffer?.length) {
      throw new BadRequestException(`Envie ${descricao}.`);
    }

    if (arquivo.size > limite) {
      throw new BadRequestException(
        `O arquivo deve ter no máximo ${limite / (1024 * 1024)} MB.`,
      );
    }

    return arquivo;
  }

  // Lê o conteúdo real do arquivo (não confia na extensão ou no MIME)
  // e garante que seja JPG, PNG ou WebP.
  private async abrirImagemRaster(buffer: Buffer): Promise<Sharp> {
    let imagem: Sharp;
    let metadados: Metadata;

    try {
      imagem = sharp(buffer, { limitInputPixels: 40_000_000 });
      metadados = await imagem.metadata();
    } catch {
      throw new BadRequestException('Arquivo de imagem inválido.');
    }

    if (
      !metadados.format ||
      !['jpeg', 'png', 'webp'].includes(metadados.format)
    ) {
      throw new BadRequestException('Formatos permitidos: JPG, PNG e WebP.');
    }

    return imagem;
  }

  // Caminho local de uma URL pública desta loja, ou null se a URL não
  // pertencer à pasta de uploads da loja.
  private caminhoLocalDaLoja(lojaId: number, url: string | null) {
    if (!url) return null;

    const prefixo = `${urlPublicaBackend()}/uploads/lojas/${lojaId}/`;

    if (!url.startsWith(prefixo)) return null;

    const nome = url.slice(prefixo.length);

    if (!/^[0-9a-f-]{36}\.webp$/.test(nome)) return null;

    const pasta = resolve(diretorioUploads(), 'lojas', String(lojaId));
    const caminho = resolve(pasta, nome);

    return caminho.startsWith(pasta + sep) ? caminho : null;
  }

  // Grava o arquivo convertido, atualiza a coluna e remove a imagem
  // anterior somente depois que o banco foi atualizado com sucesso.
  private async salvarImagemLoja(
    lojaId: number,
    campo: CampoImagem,
    conteudo: Buffer,
    urlAnterior: string | null,
  ) {
    const nomeArquivo = `${randomUUID()}.webp`;
    const diretorio = join(diretorioUploads(), 'lojas', String(lojaId));

    await mkdir(diretorio, { recursive: true });

    const caminhoArquivo = join(diretorio, nomeArquivo);
    await writeFile(caminhoArquivo, conteudo);

    const url = `${urlPublicaBackend()}/uploads/lojas/${lojaId}/${nomeArquivo}`;

    let lojaAtualizada;

    try {
      lojaAtualizada = await this.prisma.lojas.update({
        where: { id: lojaId },
        data: { [campo]: url },
      });
    } catch (erro) {
      // Evita deixar arquivo novo sem referência no banco
      await unlink(caminhoArquivo).catch(() => undefined);
      throw erro;
    }

    const caminhoAnterior = this.caminhoLocalDaLoja(lojaId, urlAnterior);

    if (caminhoAnterior && caminhoAnterior !== caminhoArquivo) {
      await unlink(caminhoAnterior).catch(() => undefined);
    }

    return lojaAtualizada;
  }

  async adicionarBanner(
    lojaId: number,
    usuarioId: number,
    arquivo: Express.Multer.File | undefined,
  ) {
    const loja = await this.buscarLojaDoUsuario(lojaId, usuarioId);
    const recebido = this.exigirArquivo(
      arquivo,
      'uma imagem de banner',
      LIMITE_IMAGEM,
    );
    const imagem = await this.abrirImagemRaster(recebido.buffer);

    let conteudo: Buffer;

    try {
      conteudo = await imagem.rotate().webp({ quality: 85 }).toBuffer();
    } catch {
      throw new BadRequestException('Não foi possível processar o banner.');
    }

    return this.salvarImagemLoja(lojaId, 'banner_url', conteudo, loja.banner_url);
  }

  async adicionarFotoPerfil(
    lojaId: number,
    usuarioId: number,
    arquivo: Express.Multer.File | undefined,
  ) {
    const loja = await this.buscarLojaDoUsuario(lojaId, usuarioId);
    const recebido = this.exigirArquivo(
      arquivo,
      'uma foto de perfil',
      LIMITE_IMAGEM,
    );
    const imagem = await this.abrirImagemRaster(recebido.buffer);

    let conteudo: Buffer;

    try {
      conteudo = await imagem
        .rotate()
        .resize(512, 512, { fit: 'cover', position: 'centre' })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'Não foi possível processar a foto de perfil.',
      );
    }

    return this.salvarImagemLoja(
      lojaId,
      'foto_perfil_url',
      conteudo,
      loja.foto_perfil_url,
    );
  }

  async adicionarLogo(
    lojaId: number,
    usuarioId: number,
    arquivo: Express.Multer.File | undefined,
  ) {
    const loja = await this.buscarLojaDoUsuario(lojaId, usuarioId);
    const recebido = this.exigirArquivo(
      arquivo,
      'a logo em SVG, PNG, JPG, JPEG ou WebP',
      LIMITE_LOGO,
    );

    const raster = temAssinaturaRaster(recebido.buffer);

    // SVG é validado antes de qualquer processamento pelo renderizador,
    // mesmo se tiver extensão ou MIME de PNG/JPEG/WebP.
    if (!raster) {
      try {
        validarSvgSeguro(recebido.buffer);
      } catch (erro) {
        if (erro instanceof SvgInvalidoError) {
          throw new BadRequestException(erro.message);
        }
        throw new BadRequestException('Formatos de logo permitidos: SVG, PNG, JPG, JPEG e WebP.');
      }
    }

    // Todos os formatos são publicados como WebP, sem servir o original.
    let conteudo: Buffer;

    try {
      const imagem = raster
        ? await this.abrirImagemRaster(recebido.buffer)
        : sharp(recebido.buffer, {
            density: 300,
            limitInputPixels: 40_000_000,
          });
      const metadados = await imagem.metadata();

      if (!raster && metadados.format !== 'svg') {
        throw new Error('Formato inesperado');
      }

      conteudo = await imagem
        .rotate()
        .resize(512, 512, { fit: 'inside', withoutEnlargement: false })
        .webp({ quality: 90, alphaQuality: 100 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Logo inválida. Envie SVG, PNG, JPG, JPEG ou WebP de até 2 MB.');
    }

    return this.salvarImagemLoja(lojaId, 'logo_url', conteudo, loja.logo_url);
  }

  // ---------------------------------------------------------------------
  // Consultas públicas
  // ---------------------------------------------------------------------

  findAll() {
    return this.prisma.lojas.findMany({
      include: {
        categoria: { select: { id: true, nome: true } },
      },
    });
  }

  async findOne(id: number) {
    const loja = await this.prisma.lojas.findUnique({
      where: { id },
      include: {
        categoria: { select: { id: true, nome: true } },
        // Dados públicos do proprietário (sem e-mail ou senha)
        usuario: {
          select: {
            id: true,
            nome: true,
            foto_perfil_url: true,
          },
        },
        produtos: {
          orderBy: { id: 'asc' },
          include: {
            imagem: { orderBy: { ordem: 'asc' } },
            produto: { select: { nota: true } },
          },
        },
        avaliacoes_loja: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            nota: true,
            comentario: true,
            createdAt: true,
            usuario: {
              select: { id: true, nome: true, foto_perfil_url: true },
            },
          },
        },
      },
    });

    if (!loja) {
      throw new NotFoundException(
        `Loja com ID ${id} não encontrada!`,
      );
    }

    const produtos = loja.produtos.map(({ produto: avaliacoes, ...produto }) => ({
      ...produto,
      media_avaliacoes: media(avaliacoes),
      total_avaliacoes: avaliacoes.length,
    }));

    return {
      ...loja,
      produtos,
      media_avaliacoes: media(loja.avaliacoes_loja),
      total_avaliacoes: loja.avaliacoes_loja.length,
    };
  }

  // ---------------------------------------------------------------------
  // Edição e exclusão
  // ---------------------------------------------------------------------

  // Campos de imagem no PATCH só são aceitos quando:
  //   (a) repetem o valor atual (clientes que reenviam o objeto inteiro); ou
  //   (b) apontam para um arquivo já existente em uploads/lojas/<id>/.
  // Qualquer outro valor (URL externa, javascript:, etc.) gera 400.
  private async validarCamposImagemNoUpdate(
    loja: { id: number } & Record<(typeof CAMPOS_URL_IMAGEM)[number], string | null>,
    dto: UpdateLojaDto,
  ) {
    for (const campo of CAMPOS_URL_IMAGEM) {
      const valor = dto[campo];

      if (valor === undefined || valor === loja[campo]) continue;

      const caminho = this.caminhoLocalDaLoja(loja.id, valor);
      const existe = caminho
        ? await access(caminho).then(() => true, () => false)
        : false;

      if (!existe) {
        throw new BadRequestException(
          `Valor inválido para ${campo}. ` +
          'Use os endpoints /lojas/:id/imagens/* para alterar imagens.',
        );
      }
    }
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

    await this.validarCamposImagemNoUpdate(loja, updateLojaDto);

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
