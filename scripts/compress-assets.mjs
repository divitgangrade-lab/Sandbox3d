import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const dist = join(process.cwd(), 'dist');
const assets = join(dist, 'assets');

function compress(file) {
  const buffer = readFileSync(file);
  const gzip = gzipSync(buffer, { level: 9 });
  const brotli = brotliCompressSync(buffer);
  writeFileSync(`${file}.gz`, gzip);
  writeFileSync(`${file}.br`, brotli);
  return { raw: buffer.length, gzip: gzip.length, brotli: brotli.length };
}

const files = [];
if (existsSync(join(dist, 'index.html'))) files.push(join(dist, 'index.html'));
for (const name of readdirSync(assets)) {
  if (['.js', '.css', '.html', '.wasm'].includes(extname(name))) files.push(join(assets, name));
}

if (files.length === 0) {
  console.error('No build output found. Run `npm run build` first.');
  process.exit(1);
}

let raw = 0;
let gzipTotal = 0;
let brotliTotal = 0;
for (const file of files) {
  const result = compress(file);
  raw += result.raw;
  gzipTotal += result.gzip;
  brotliTotal += result.brotli;
  console.log(
    `${file.replace(`${dist}/`, '')}: ${(result.raw / 1024).toFixed(1)} KB → gzip ${(result.gzip / 1024).toFixed(1)} KB · brotli ${(result.brotli / 1024).toFixed(1)} KB`,
  );
}
console.log(
  `Compressed ${files.length} files: ${(raw / 1024).toFixed(1)} KB raw → ${(gzipTotal / 1024).toFixed(1)} KB gzip / ${(brotliTotal / 1024).toFixed(1)} KB brotli`,
);
