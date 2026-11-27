import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const LIMITE_FOTO = 2 * 1024 * 1024;
export const LIMITE_IMAGEM_PRODUTO = 5 * 1024 * 1024;

export async function converterImagem(
  arquivo: Express.Multer.File | undefined,
  // fotoPerfil só muda o recorte final (quadrado 512x512); os formatos aceitos são os mesmos.
  fotoPerfil = false,
  limite = LIMITE_FOTO,
) {
  if (!arquivo?.buffer?.length)
    throw new BadRequestException('Envie uma imagem.');
  if (arquivo.size > limite || arquivo.buffer.length > limite) {
    throw new BadRequestException(
      `A imagem deve ter no máximo ${limite / 1024 / 1024} MB.`,
    );
  }

  const buffer = arquivo.buffer;
  const png = buffer
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  const webp =
    buffer.subarray(0, 4).equals(Buffer.from('RIFF')) &&
    buffer.subarray(8, 12).equals(Buffer.from('WEBP'));

  // SVGs e formatos não permitidos nunca chegam ao decodificador.
  if (!(png || jpeg || webp)) {
    throw new BadRequestException('Envie PNG, JPG, JPEG ou WebP válido.');
  }

  try {
    const imagem = sharp(buffer, {
      limitInputPixels: 40_000_000,
      failOn: 'warning',
    });
    const meta = await imagem.metadata();
    if (
      !['png', 'jpeg', 'webp'].includes(meta.format ?? '') ||
      (meta.pages ?? 1) > 1
    ) {
      throw new Error('Formato não permitido');
    }
    return await imagem
      .rotate()
      .resize(
        fotoPerfil
          ? { width: 512, height: 512, fit: 'cover' }
          : {
              width: 900,
              height: 700,
              fit: 'inside',
              withoutEnlargement: true,
            },
      )
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new BadRequestException('Imagem inválida ou corrompida.');
  }
}

function basePublica() {
  return (
    process.env.BACKEND_PUBLIC_URL ??
    process.env.BACKEND_URL ??
    'http://localhost:3001'
  ).replace(/\/+$/, '');
}

export async function gravarImagem(
  pasta: 'usuarios' | 'produtos',
  id: number,
  buffer: Buffer,
) {
  const nome = `${randomUUID()}.webp`;
  const diretorio = join(process.cwd(), 'uploads', pasta, String(id));
  await mkdir(diretorio, { recursive: true });
  const caminho = join(diretorio, nome);
  await writeFile(caminho, buffer, { flag: 'wx' });
  return { caminho, url: `${basePublica()}/uploads/${pasta}/${id}/${nome}` };
}

export async function removerArquivo(caminho: string) {
  await unlink(caminho).catch(() => undefined);
}

// Só remove arquivos locais associados ao produto autorizado, nos formatos
// legados da dev ou no diretório WebP atual. Nunca utiliza apenas o basename.
export async function removerImagemProduto(id: number, url: string) {
  let caminho = url;
  if (!url.startsWith('/uploads/')) {
    const prefixo = `${basePublica()}/uploads/`;
    if (!url.startsWith(prefixo)) return;
    caminho = `/uploads/${url.slice(prefixo.length)}`;
  }
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const permitido = new RegExp(
    `^/uploads/produtos/(?:${id}/)?${uuid}\\.(?:jpe?g|png|webp)$`,
    'i',
  );
  if (!permitido.test(caminho)) return;
  await removerArquivo(join(process.cwd(), caminho.slice(1)));
}

export async function removerFotoAnterior(id: number, url: string | null) {
  const prefixo = `${basePublica()}/uploads/usuarios/${id}/`;
  if (!url?.startsWith(prefixo)) return;
  const nome = url.slice(prefixo.length);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(
      nome,
    )
  )
    return;
  await removerArquivo(
    join(process.cwd(), 'uploads', 'usuarios', String(id), nome),
  );
}
