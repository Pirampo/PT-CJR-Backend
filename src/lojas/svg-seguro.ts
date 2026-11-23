// Validação estrutural e restritiva de logos SVG.
//
// Em vez de procurar padrões perigosos (lista negra), este módulo faz uma
// análise sintática estrita do XML e só aceita um subconjunto pequeno e
// passivo do SVG (lista permitida de elementos, atributos e referências).
// Qualquer construção fora desse subconjunto é rejeitada:
//   - DOCTYPE / ENTITY (XXE), CDATA e instruções de processamento;
//   - elementos ativos ou que carregam conteúdo externo (script,
//     foreignObject, image, animate, etc.) e elementos de outros namespaces;
//   - atributos de evento (on*) e qualquer atributo desconhecido;
//   - referências que não sejam âncoras locais (#id).
//
// O SVG validado nunca é publicado: o serviço o converte para WebP.

export class SvgInvalidoError extends Error {}

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const ELEMENTOS_PERMITIDOS = new Set([
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern',
  'title',
  'desc',
  'text',
  'tspan',
  'style',
]);

const ATRIBUTOS_PERMITIDOS = new Set([
  // estrutura
  'id',
  'class',
  'style',
  'xmlns',
  'xmlns:xlink',
  'version',
  'viewBox',
  'preserveAspectRatio',
  'width',
  'height',
  'x',
  'y',
  'transform',
  // geometria
  'd',
  'points',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x1',
  'y1',
  'x2',
  'y2',
  'pathLength',
  // apresentação
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'color',
  'display',
  'visibility',
  'clip-path',
  'clip-rule',
  'mask',
  'paint-order',
  'vector-effect',
  'shape-rendering',
  // gradientes, padrões e máscaras
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'fx',
  'fy',
  'fr',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  // texto
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'dx',
  'dy',
  // referências locais (validadas à parte)
  'href',
  'xlink:href',
  // estilo
  'type',
  'media',
]);

const ATRIBUTOS_DE_REFERENCIA = new Set(['href', 'xlink:href']);

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

const NOME_XML = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;

function falhar(mensagem: string): never {
  throw new SvgInvalidoError(mensagem);
}

function decodificarEntidades(texto: string): string {
  return texto.replace(/&([^;&\s]*);?/g, (trecho, nome: string) => {
    if (!trecho.endsWith(';')) {
      falhar('O SVG contém uma referência de entidade malformada.');
    }

    if (Object.hasOwn(ENTIDADES, nome)) return ENTIDADES[nome];

    const numerica = /^#(?:x([0-9a-fA-F]{1,6})|([0-9]{1,7}))$/.exec(nome);

    if (numerica) {
      const codigo = parseInt(numerica[1] ?? numerica[2], numerica[1] ? 16 : 10);

      if (
        ![0x9, 0xa, 0xd].includes(codigo) &&
        !(codigo >= 0x20 && codigo <= 0xd7ff) &&
        !(codigo >= 0xe000 && codigo <= 0xfffd) &&
        !(codigo >= 0x10000 && codigo <= 0x10ffff)
      ) {
        falhar('O SVG contém um caractere inválido.');
      }

      return String.fromCodePoint(codigo);
    }

    return falhar(
      'O SVG contém entidades não permitidas. Exporte-o como SVG simples.',
    );
  });
}

// Garante que qualquer url(...) presente em CSS ou atributos aponte apenas
// para um elemento local (#id) e que não existam construções que carreguem
// recursos ou executem código.
function validarCss(valor: string, estiloCompleto = false) {
  const normalizado = valor.toLowerCase();

  if (normalizado.includes('\\') || /\/\*|\*\/|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(normalizado)) {
    falhar('O SVG contém escapes, comentários ou controles de CSS não permitidos.');
  }

  if (
    normalizado.includes('@') ||
    normalizado.includes('expression(') ||
    normalizado.includes('javascript:') ||
    normalizado.includes('data:')
  ) {
    falhar('O SVG contém estilos que carregam conteúdo externo.');
  }

  const urls = normalizado.match(/url\s*\([^)]*\)?/g) ?? [];

  for (const url of urls) {
    if (!/^url\(\s*(['"]?)#[a-z0-9_.:-]+\1\s*\)$/i.test(url)) {
      falhar('O SVG só pode referenciar elementos internos (#id).');
    }
  }

  // CSS de logos só precisa de referências locais e funções de cor.
  // Rejeita também image-set(), var(), src() e funções desconhecidas,
  // que não são cobertas pela procura exclusiva de url().
  if (estiloCompleto) {
    const semUrls = normalizado.replace(/url\([^)]*\)/g, '');
    for (const chamada of semUrls.matchAll(/([^\s:;,{}()]+)\s*\(/g)) {
      if (!/^(rgb|rgba|hsl|hsla)$/.test(chamada[1])) {
        falhar('O SVG contém uma função de CSS não permitida.');
      }
    }
  }
}

type Tag = { nome: string; atributos: Map<string, string> };

function lerAtributos(trecho: string): Map<string, string> {
  const atributos = new Map<string, string>();
  const padrao = /\s+([^\s=/>"']+)\s*=\s*("([^"<]*)"|'([^'<]*)')/y;
  let posicao = 0;

  while (posicao < trecho.length) {
    if (/^\s*$/.test(trecho.slice(posicao))) break;

    padrao.lastIndex = posicao;
    const encontrado = padrao.exec(trecho);

    if (!encontrado) {
      falhar('O SVG contém atributos malformados.');
    }

    const nome = encontrado[1];

    if (!NOME_XML.test(nome)) {
      falhar('O SVG contém um nome de atributo inválido.');
    }

    if (atributos.has(nome)) {
      falhar(`O atributo "${nome}" está repetido no SVG.`);
    }

    atributos.set(
      nome,
      decodificarEntidades(encontrado[3] ?? encontrado[4] ?? ''),
    );
    posicao = padrao.lastIndex;
  }

  return atributos;
}

function validarTag(tag: Tag, raiz: boolean) {
  if (!ELEMENTOS_PERMITIDOS.has(tag.nome)) {
    falhar(
      `O elemento <${tag.nome}> não é permitido em logos. ` +
        'Exporte a logo como SVG simples, sem scripts, imagens ou metadados de editor.',
    );
  }

  for (const [nome, valor] of tag.atributos) {
    if (/^on/i.test(nome)) {
      falhar('O SVG contém atributos de evento, que não são permitidos.');
    }

    if (!ATRIBUTOS_PERMITIDOS.has(nome)) {
      falhar(`O atributo "${nome}" não é permitido em logos SVG.`);
    }

    if (ATRIBUTOS_DE_REFERENCIA.has(nome)) {
      if (!/^#[A-Za-z0-9_.:-]+$/.test(valor.trim())) {
        falhar('O SVG só pode referenciar elementos internos (#id).');
      }
      continue;
    }

    if (nome === 'xmlns' && valor !== SVG_NS) {
      falhar('O namespace do SVG é inválido.');
    }

    if (nome === 'xmlns:xlink' && valor !== XLINK_NS) {
      falhar('O namespace xlink do SVG é inválido.');
    }

    if (nome !== 'xmlns' && nome !== 'xmlns:xlink') {
      validarCss(valor, nome === 'style');
    }
  }

  if (raiz) {
    if (tag.nome !== 'svg') {
      falhar('O arquivo enviado não é um SVG.');
    }

    if (tag.atributos.get('xmlns') !== SVG_NS) {
      falhar('O SVG deve declarar o namespace http://www.w3.org/2000/svg.');
    }
  }
}

/**
 * Valida estruturalmente um SVG. Lança SvgInvalidoError com uma mensagem
 * compreensível quando o conteúdo não pertence ao subconjunto permitido.
 */
export function validarSvgSeguro(buffer: Buffer): void {
  let xml: string;

  try {
    xml = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    falhar('O SVG deve estar codificado em UTF-8.');
  }

  // Remove BOM e a declaração XML opcional (somente no início do arquivo).
  xml = xml.replace(/^﻿/, '');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/.test(xml)) {
    falhar('O SVG contém caracteres XML inválidos.');
  }
  const declaracao = /^<\?xml\s+version\s*=\s*(['"])1\.0\1(?:\s+encoding\s*=\s*(['"])UTF-8\2)?(?:\s+standalone\s*=\s*(['"])(?:yes|no)\3)?\s*\?>/i.exec(xml);

  if (declaracao) {
    if (/encoding\s*=\s*["'](?!utf-8["'])/i.test(declaracao[0])) {
      falhar('O SVG deve estar codificado em UTF-8.');
    }
    xml = xml.slice(declaracao[0].length);
  }

  const pilha: string[] = [];
  let encontrouRaiz = false;
  let raizFechada = false;
  let posicao = 0;
  let elementos = 0;

  while (posicao < xml.length) {
    const inicioTag = xml.indexOf('<', posicao);
    const texto = xml.slice(posicao, inicioTag === -1 ? xml.length : inicioTag);

    if (texto.includes('>')) {
      falhar('O SVG contém caracteres inválidos fora das tags.');
    }

    if (texto.trim()) {
      if (pilha.length === 0) {
        falhar('O SVG contém texto fora do elemento <svg>.');
      }

      const conteudo = decodificarEntidades(texto);

      if (pilha[pilha.length - 1] === 'style') {
        validarCss(conteudo, true);
      }
    }

    if (inicioTag === -1) break;

    // Comentários são permitidos e ignorados.
    if (xml.startsWith('<!--', inicioTag)) {
      // Não deixa comentários XML fragmentarem tokens CSS entre trechos
      // validados separadamente (por exemplo, @im<!-- -->port).
      if (pilha[pilha.length - 1] === 'style') {
        falhar('Comentários XML não são permitidos dentro de estilos.');
      }
      const fim = xml.indexOf('-->', inicioTag + 4);

      if (fim === -1) falhar('O SVG contém um comentário não finalizado.');

      if (xml.slice(inicioTag + 4, fim).includes('--')) {
        falhar('O SVG contém um comentário malformado.');
      }

      posicao = fim + 3;
      continue;
    }

    // DOCTYPE, ENTITY, CDATA e instruções de processamento não são aceitos.
    if (xml.startsWith('<!', inicioTag) || xml.startsWith('<?', inicioTag)) {
      falhar(
        'O SVG contém declarações não permitidas (DOCTYPE, ENTITY, CDATA ou instruções de processamento).',
      );
    }

    const fimTag = xml.indexOf('>', inicioTag);

    if (fimTag === -1) falhar('O SVG está malformado.');

    const conteudoTag = xml.slice(inicioTag + 1, fimTag);

    if (conteudoTag.includes('<')) {
      falhar('O SVG está malformado.');
    }

    // Tag de fechamento
    if (conteudoTag.startsWith('/')) {
      const nome = conteudoTag.slice(1).trimEnd();
      const esperado = pilha.pop();

      if (nome !== esperado) {
        falhar('O SVG está malformado (tags não correspondem).');
      }

      if (pilha.length === 0) raizFechada = true;

      posicao = fimTag + 1;
      continue;
    }

    if (raizFechada) {
      falhar('O SVG contém elementos fora do elemento <svg>.');
    }

    if (pilha[pilha.length - 1] === 'style') {
      falhar('Elementos não são permitidos dentro de estilos.');
    }
    elementos += 1;
    if (pilha.length >= 64 || elementos > 10_000) {
      falhar('O SVG excede o limite de complexidade permitido.');
    }

    const autoFechada = conteudoTag.endsWith('/');
    const corpo = autoFechada ? conteudoTag.slice(0, -1) : conteudoTag;
    const nome = /^[^\s/>]+/.exec(corpo)?.[0] ?? '';

    if (!NOME_XML.test(nome)) {
      falhar('O SVG contém um elemento com nome inválido.');
    }

    const tag: Tag = {
      nome,
      atributos: lerAtributos(corpo.slice(nome.length)),
    };

    validarTag(tag, !encontrouRaiz);
    encontrouRaiz = true;

    if (autoFechada) {
      if (pilha.length === 0) raizFechada = true;
    } else {
      pilha.push(nome);
    }

    posicao = fimTag + 1;
  }

  if (!encontrouRaiz) {
    falhar('O arquivo enviado não é um SVG.');
  }

  if (pilha.length > 0 || !raizFechada) {
    falhar('O SVG está incompleto ou malformado.');
  }
}
