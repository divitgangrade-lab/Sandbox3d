import { readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const dir = join(process.cwd(), 'dist', 'assets');
let files;
try {
  files = readdirSync(dir).filter((name) => ['.js', '.css'].includes(extname(name)));
} catch {
  console.error('No dist/assets found. Run `npm run build` first.');
  process.exit(1);
}
if (files.length === 0) {
  console.error('No JS/CSS assets in dist/assets.');
  process.exit(1);
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
let rawTotal = 0;
let gzipTotal = 0;
let brotliTotal = 0;
console.log('asset'.padEnd(34), 'raw'.padStart(10), 'gzip'.padStart(10), 'brotli'.padStart(10));
for (const name of files.sort()) {
  const buffer = readFileSync(join(dir, name));
  const gzip = gzipSync(buffer, { level: 9 });
  const brotli = brotliCompressSync(buffer);
  rawTotal += buffer.length;
  gzipTotal += gzip.length;
  brotliTotal += brotli.length;
  console.log(name.padEnd(34), kb(buffer.length).padStart(10), kb(gzip.length).padStart(10), kb(brotli.length).padStart(10));
}
console.log('-'.repeat(68));
console.log('TOTAL'.padEnd(34), kb(rawTotal).padStart(10), kb(gzipTotal).padStart(10), kb(brotliTotal).padStart(10));
