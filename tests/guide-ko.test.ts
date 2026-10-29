// 공략 시트 한국어 지문 (기획 121 2장 「한국어 UI는 1px도 깨지지 않게」, 3단계 ⑤-b): 모든 장소 × 난이도의 공략 HTML (guideHtml, 전투 없음)의 SHA-256을
// tests/fixtures/guide-ko.json과 비교한다. 문장 틀을 t()로 옮기거나 글을 만드는 코드를 고쳐도 한국어 공략 글이 그대로인지 본다.
// 한국어 공략 글을 일부러 바꾼 PR만 GUIDE_KO=write npx vitest run tests/guide-ko.test.ts 로 기준을 다시 뜨고 PR에 까닭을 적는다.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { guideHtml, guideModel } from '../src/battle/guide';
import { ENCOUNTERS, type EncounterKey } from '../src/data/encounters';
import { DIFFS, type DiffName } from '../src/data/difficulty';

const FILE = fileURLToPath(new URL('./fixtures/guide-ko.json', import.meta.url));
const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

describe('공략 시트 한국어 지문', () => {
  it('모든 장소 × 난이도의 공략 HTML이 기준과 같음', () => {
    const write = process.env.GUIDE_KO === 'write';
    const base: Record<string, string> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
    const got: Record<string, string> = {};
    const html: Record<string, string> = {};
    for (const key of Object.keys(ENCOUNTERS) as EncounterKey[]) for (const diff of Object.keys(DIFFS) as DiffName[]) {
      const h = guideHtml(guideModel(key, diff, 30, 30), null);
      got[`${key}|${diff}`] = sha(h); html[`${key}|${diff}`] = h;
    }
    if (write) { writeFileSync(FILE, JSON.stringify(got, null, 0).replace(/,"/g, ',\n"') + '\n'); return; }
    expect(Object.keys(base).length, '기준 파일 (GUIDE_KO=write 로 뜸)').toBeGreaterThan(0);
    const diff = Object.keys(got).filter(k => base[k] !== got[k]);
    if (diff.length) {
      const k = diff[0], dir = fileURLToPath(new URL('./e2e/shots/', import.meta.url));
      writeFileSync(`${dir}guide-ko-${k.replace('|', '-')}.html`, html[k]);
      console.log(`공략 한국어 글이 달라진 칸 ${diff.length}개: ${diff.slice(0, 8).join(', ')} … 첫 칸 HTML → ${dir}guide-ko-${k.replace('|', '-')}.html`);
    }
    expect(diff).toEqual([]);
  });
});
