import { SvgInvalidoError, validarSvgSeguro } from './svg-seguro.js';

const NS = 'xmlns="http://www.w3.org/2000/svg"';

function svg(conteudo: string, atributos = '') {
  return Buffer.from(`<svg ${NS}${atributos} viewBox="0 0 10 10">${conteudo}</svg>`);
}

function rejeita(buffer: Buffer) {
  expect(() => validarSvgSeguro(buffer)).toThrow(SvgInvalidoError);
}

describe('validarSvgSeguro', () => {
  it('aceita um SVG simples', () => {
    expect(() =>
      validarSvgSeguro(
        Buffer.from(
          `<?xml version="1.0" encoding="UTF-8"?>\n<!-- logo -->\n<svg ${NS} width="10" height="10"><title>Logo</title><rect x="0" y="0" width="10" height="10" fill="#6A38F3"/></svg>`,
        ),
      ),
    ).not.toThrow();
  });

  it('aceita gradiente referenciado por url(#id), <use> local e <style> passivo', () => {
    expect(() =>
      validarSvgSeguro(
        svg(
          '<defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient>' +
            '<style>.a{fill:url(#g)}</style><path id="p" d="M0 0h10v10z"/></defs>' +
            '<use href="#p"/><circle class="a" cx="5" cy="5" r="4" style="fill:url(\'#g\')"/>',
          ' xmlns:xlink="http://www.w3.org/1999/xlink"',
        ),
      ),
    ).not.toThrow();
  });

  it('rejeita <script>', () => rejeita(svg('<script>alert(1)</script>')));

  it('rejeita atributos de evento', () =>
    rejeita(svg('<rect width="1" height="1" onload="alert(1)"/>')));

  it('rejeita onload na raiz', () =>
    rejeita(Buffer.from(`<svg ${NS} onload="alert(1)"></svg>`)));

  it('rejeita foreignObject', () =>
    rejeita(svg('<foreignObject><div>x</div></foreignObject>')));

  it('rejeita <image> com referência externa', () =>
    rejeita(svg('<image href="http://exemplo.com/a.png"/>')));

  it('rejeita <use> com href externo', () =>
    rejeita(svg('<use href="http://exemplo.com/a.svg#x"/>')));

  it('rejeita xlink:href javascript:', () =>
    rejeita(svg('<use xlink:href="javascript:alert(1)"/>', ' xmlns:xlink="http://www.w3.org/1999/xlink"')));

  it('rejeita DOCTYPE/ENTITY (XXE)', () =>
    rejeita(
      Buffer.from(
        `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg ${NS}><text>&xxe;</text></svg>`,
      ),
    ));

  it('rejeita entidades não predefinidas', () =>
    rejeita(svg('<text>&xxe;</text>')));

  it('rejeita xml-stylesheet', () =>
    rejeita(
      Buffer.from(`<?xml version="1.0"?><?xml-stylesheet href="http://x/a.css"?><svg ${NS}/>`),
    ));

  it('rejeita CDATA', () => rejeita(svg('<style><![CDATA[a{}]]></style>')));

  it('rejeita url() externa dentro de <style>', () =>
    rejeita(svg('<style>.a{fill:url(http://exemplo.com/x.svg#g)}</style>')));

  it('rejeita @import em <style>', () =>
    rejeita(svg('<style>@import "http://exemplo.com/a.css";</style>')));

  it('rejeita url() externa em atributo de apresentação', () =>
    rejeita(svg('<rect fill="url(https://exemplo.com/a#b)" width="1" height="1"/>')));

  it('rejeita elementos de editor (inkscape/sodipodi)', () =>
    rejeita(svg('<sodipodi:namedview id="n"/>')));

  it('rejeita animações', () =>
    rejeita(svg('<set attributeName="href" to="javascript:alert(1)"/>')));

  it('rejeita XML malformado', () => rejeita(Buffer.from(`<svg ${NS}><g></svg>`)));

  it('rejeita raiz que não é <svg>', () =>
    rejeita(Buffer.from('<html><body>oi</body></html>')));

  it('rejeita SVG sem namespace', () => rejeita(Buffer.from('<svg></svg>')));

  it('rejeita conteúdo binário/PNG', () =>
    rejeita(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe])));

  it('rejeita elementos após o fechamento da raiz', () =>
    rejeita(Buffer.from(`<svg ${NS}></svg><script>alert(1)</script>`)));

  it.each([
    '<style>@im/**/port "https://externo/x.css";</style>',
    '<style>.a{fill:u/**/rl(https://externo/x)}</style>',
    '<style>.a{fill:u<!-- comentário -->rl(https://externo/x)}</style>',
    '<style>.a{fill:u<g/>rl(https://externo/x)}</style>',
    '<style>.a{background:image-set("https://externo/x.png" 1x)}</style>',
    '<style>.a{fill:var(--recurso)}</style>',
    '<style>@namespace x "https://externo/x";</style>',
    '<rect style="fill:u\\72l(https://externo/x)"/>',
    '<rect style="fill:url(&#104;ttps://externo/x)"/>',
    '<use href="&#104;ttps://externo/x"/>',
    '<text>&constructor;</text>',
    '<text>&__proto__;</text>',
    '<text>&amp</text>',
    '<text>&#0;</text>',
    '<text>&#xD800;</text>',
    '<text>&#xFFFF;</text>',
    '<text>\u0000</text>',
    '<rect width="1" width="2"/>',
    '<g></ g>',
  ])('rejeita tentativas de contornar o subconjunto permitido: %s', (conteudo) => rejeita(svg(conteudo)));

  it('aceita cores CSS e texto com entidades XML predefinidas', () => {
    expect(() => validarSvgSeguro(svg('<style>.a{fill:rgb(10,20,30);stroke:rgba(0,0,0,0.5)}</style><text>A &amp; B &#xE9;</text>'))).not.toThrow();
  });

  it('rejeita aninhamento excessivo', () => rejeita(svg('<g>'.repeat(65) + '</g>'.repeat(65))));
});
