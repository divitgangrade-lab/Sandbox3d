import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const source = join(dist, 'app.html');
const target = join(dist, 'index.html');

if (!existsSync(source)) {
  console.error('No dist/app.html found. Run `npm run build` first.');
  process.exit(1);
}

copyFileSync(source, target);
console.log('dist/app.html -> dist/index.html');
