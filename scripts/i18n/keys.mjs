// 사전 점검 도구 (기획 121): node scripts/i18n/keys.mjs [--missing] [--unused] [--all]
//   --missing  코드의 t() 열쇠 가운데 en · ja 사전에 없는 것 (기본)
//   --unused   사전에 있지만 코드의 t()에 없는 열쇠 (t(변수)로 쓰는 데이터 이름은 여기 나올 수 있음)
//   --all      둘 다
import { fileURLToPath } from 'node:url';
import { scanHtmlKeys, scanKeys } from './scan.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const en = (await import(new URL('../../src/i18n/en.ts', import.meta.url).href)).default;
const ja = (await import(new URL('../../src/i18n/ja.ts', import.meta.url).href)).default;
const args = new Set(process.argv.slice(2));
const missing = args.has('--missing') || args.has('--all') || !args.has('--unused');
const unused = args.has('--unused') || args.has('--all');
const found = scanKeys(root + 'src');
const keys = new Set([...found.map(k => k.key), ...scanHtmlKeys(root + 'index.html')]);
console.log(`t() 열쇠 ${keys.size} (${found.length}곳) · en ${Object.keys(en).length} · ja ${Object.keys(ja).length}`);
if (missing) for (const [name, d] of [['en', en], ['ja', ja]]) {
  const miss = [...keys].filter(k => !(k in d));
  console.log(`\n${name} 없음 ${miss.length}:`); miss.forEach(k => console.log(`  ${JSON.stringify(k)}: '',`));
}
if (unused) for (const [name, d] of [['en', en], ['ja', ja]]) {
  const un = Object.keys(d).filter(k => !keys.has(k));
  console.log(`\n${name} 안 씀 ${un.length}:`); un.forEach(k => console.log(`  ${JSON.stringify(k)}`));
}
for (const k of found.filter(k => k.bad)) console.log(`템플릿 ${'$'}{} 금지 (자리값 {n}으로): ${k.file}:${k.line}`);
