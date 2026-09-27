import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Bundled Lato webfonts (latin subset, from Google Fonts).  Visual tests
// inject these via @font-face data URIs and block the Google Fonts CDN, so
// text renders with identical metrics in CI and locally regardless of
// network.  Files: lato-<weight>-<style>.woff2.
const FONTS = [
  { weight: 300, style: 'italic', file: 'lato-300-italic.woff2' },
  { weight: 400, style: 'italic', file: 'lato-400-italic.woff2' },
  { weight: 700, style: 'italic', file: 'lato-700-italic.woff2' },
  { weight: 300, style: 'normal', file: 'lato-300-normal.woff2' },
  { weight: 400, style: 'normal', file: 'lato-400-normal.woff2' },
  { weight: 700, style: 'normal', file: 'lato-700-normal.woff2' },
  { weight: 900, style: 'normal', file: 'lato-900-normal.woff2' },
];

const here = dirname(fileURLToPath(import.meta.url));

export function latoFontCss(): string {
  return FONTS.map(({ weight, style, file }) => {
    const b64 = readFileSync(join(here, 'fonts', file)).toString('base64');
    return `@font-face { font-family: 'Lato'; font-style: ${style}; font-weight: ${weight}; font-display: block; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`;
  }).join('\n');
}
