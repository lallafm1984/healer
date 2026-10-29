// 코드의 t('…') 열쇠 모으기 (기획 121 2장): src/**/*.ts에서 t('한국어') · t("…") · t(`…`) (자리값은 {n}, ${}는 안 됨). 단위 테스트와 keys.mjs가 같이 씀
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RE = /(?<![\w.$])t\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/g;
const unescape = s => s.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c));

export function walk(dir) {
  return readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
}

/** [{ key, file, line, bad }] (bad = 템플릿 안 ${}) */
export function scanKeys(root) {
  const out = [];
  for (const file of walk(root)) {
    // 주석 안의 t('…') 보기 (설명 · 예시)는 열쇠가 아님
    const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    for (const m of src.matchAll(RE)) {
      const raw = m[1] ?? m[2] ?? m[3];
      const line = src.slice(0, m.index).split('\n').length;
      const key = unescape(raw);
      if (!/[가-힣]/.test(key)) continue; // 번역 열쇠는 한국어 원문. 영문만 든 t('…')는 다른 t (지역 변수 · 데이터 함수)
      out.push({ key, file, line, bad: m[3] != null && raw.includes('${') });
    }
  }
  return out;
}

/** 자리값 이름 묶음 ({n} · {a}) */
export const slots = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
