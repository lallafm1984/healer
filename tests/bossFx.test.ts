/** 묶음 H 보스 기술 이펙트 (63 E): 표의 대본 · 기술 키가 데이터에 있고, 그림 이름이 받은 파일 · 문서 이름 */
import { describe, expect, it } from 'vitest';
import { art } from '../src/art';
import { BOSSES, type BossDef } from '../src/data/bosses';
import { BOSS_FX, bossFxArt, bossFxArts, darkArt, debuffFxArt, skillBase, skillDebuffName, tideArtName, tideTail } from '../src/battle/art';

/** 63 E 1~15 */
const DOC_E = ['fx-minecart-charge', 'fx-snowball-roll', 'fx-ice-armor', 'fx-crow-swarm', 'fx-cell-hole-grain', 'fx-cell-tide-sea', 'fx-cell-tide-sea-warn', 'fx-hush',
  'fx-bubble-trap', 'fx-bubble-pop', 'fx-flour-cloud', 'fx-cream-burst', 'fx-cell-tide-poison', 'fx-cell-tide-poison-warn', 'fx-cell-jelly-omen'];
/** 63 E 아래 주석: 얼음 갑옷이 녹을 때는 기존 서리 폭발 */
const REUSED = ['fx-frost-burst'];
const bosses = BOSSES as Record<string, BossDef | undefined>;
const values = (v: string | Record<string, string> | undefined): string[] => (v == null ? [] : typeof v === 'string' ? [v] : Object.values(v));

describe('묶음 H 보스 기술 이펙트 (63 E)', () => {
  it('표의 그림은 받은 파일이고 63 E 이름 (녹을 때는 기존 서리 폭발)', () => {
    for (const [script, o] of Object.entries(BOSS_FX)) for (const v of Object.values(o)) for (const a of values(v)) {
      expect([...DOC_E, ...REUSED], `${script} ${a}`).toContain(a);
      expect(art(a), a).not.toBe('');
    }
  });

  it('63 E 15장이 모두 어딘가에 쓰임 (밀물 칸은 세력, 나머지는 BOSS_FX)', () => {
    const used = new Set([...Object.keys(BOSS_FX).flatMap(bossFxArts), ...(['pirate', 'swamp'] as const).flatMap(f => [tideArtName(f), tideArtName(f, true)])]);
    for (const a of DOC_E) expect(used.has(a), a).toBe(true);
  });

  it('기술 키가 그 보스 데이터에 있음 (번호 꼬리 뺀 이름도 됨). 디버프 · 감옥 칸은 그 기술의 디버프 이름이 나옴', () => {
    for (const [script, o] of Object.entries(BOSS_FX)) {
      const b = bosses[script];
      expect(b, script).toBeDefined();
      const keys = new Set(b!.skills.flatMap(d => [d.key, skillBase(d.key)]));
      for (const slot of ['land', 'omen', 'hold', 'hit', 'cure'] as const) for (const k of Object.keys(o[slot] ?? {})) {
        expect(keys.has(k), `${script} ${slot} ${k}`).toBe(true);
        if (slot === 'hold' || slot === 'hit' || slot === 'cure') expect(skillDebuffName(script, k), `${script} ${slot} ${k}`).not.toBe('');
      }
      // swap = 그 전투에서 실제로 나는 엔진 연출, dark = 흐름에 체력 숫자 숨김이 있음
      const effects = b!.skills.map(d => d.effect);
      for (const fx of Object.keys(o.swap ?? {})) {
        const ok = fx === 'heartbeat' ? effects.some(e => e?.p === 'beat')
          : fx === 'swell-pop' ? effects.some(e => !!e && 'debuff' in e && !!e.debuff?.swell)
            : fx === 'jail-break' ? effects.some(e => e?.p === 'jail') : false;
        expect(ok, `${script} swap ${fx}`).toBe(true);
      }
      if (o.dark) expect(JSON.stringify(b!.flow ?? []), script).toContain('"p":"dark"');
    }
  });

  it('조용히 (시전 끊기)는 엄격이 · 쉿 · 쉿 탐험판 모두 fx-hush', () => {
    const hush = Object.entries(bosses).filter(([, b]) => b!.skills.some(d => (d.name ?? '').startsWith('조용히') && d.effect?.p === 'beat')).map(([k]) => k).sort();
    expect(hush).toEqual(['eomgyeok', 'swit', 'swit90']);
    for (const k of hush) expect(bossFxArt(k, 'swap', 'heartbeat')).toBe('fx-hush');
    expect(bossFxArt('abyssheart', 'swap', 'heartbeat')).toBe(''); // 심장의 크게 뛰기는 그대로
  });

  it('기술 키 · 디버프 이름으로 그림을 찾음', () => {
    expect(bossFxArt('gurit', 'land', 'cart0b')).toBe('fx-minecart-charge');
    expect(bossFxArt('ppodeuk25', 'land', 'roll2')).toBe('fx-snowball-roll');
    expect(bossFxArt('nadal', 'land', 'grain21')).toBe('fx-cell-hole-grain');
    expect(bossFxArt('chalrang', 'omen', 'omen1')).toBe('fx-cell-jelly-omen');
    expect(bossFxArt('chalrang', 'swap', 'jail-break')).toBe('fx-bubble-pop');
    expect(bossFxArt('malmijal', 'swap', 'jail-break')).toBe(''); // 촉수 감옥은 그대로
    expect(bossFxArt('kongkong', 'land', 'beat')).toBe('');
    expect(bossFxArt('trash', 'land', 'cart0')).toBe('');
    expect(debuffFxArt('icia', 'hold', '얼음 갑옷')).toBe('fx-ice-armor');
    expect(debuffFxArt('icia', 'cure', '얼음 갑옷')).toBe('fx-frost-burst');
    expect(debuffFxArt('banjjak', 'hold', '수정 갑옷')).toBe(''); // 같은 부품이지만 63 E에 없음 (기존 fx-absorb)
    expect(debuffFxArt('geopum', 'hold', '역병 거품')).toBe('fx-bubble-trap');
    expect(debuffFxArt('chalrang', 'hold', '물거품 감옥')).toBe('fx-bubble-trap');
    expect(debuffFxArt('jipdan', 'hit', '까마귀 쪼기')).toBe('fx-crow-swarm');
    expect(debuffFxArt('jipdan30', 'hit', '까마귀 쪼기')).toBe('fx-crow-swarm');
    expect(debuffFxArt('monggeul', 'hit', '크림 범벅')).toBe('fx-cream-burst');
    expect(darkArt('polpol')).toBe('fx-flour-cloud');
    expect(darkArt('abysslord')).toBe(''); // 영원한 저녁은 그대로
  });

  it('밀물 칸: 짠물 해적단 = 짠물, 늪 = 독 연못, 그 밖 = 어둠물', () => {
    expect([tideTail('pirate'), tideArtName('pirate'), tideArtName('pirate', true)]).toEqual(['sea', 'fx-cell-tide-sea', 'fx-cell-tide-sea-warn']);
    expect([tideTail('swamp'), tideArtName('swamp'), tideArtName('swamp', true)]).toEqual(['poison', 'fx-cell-tide-poison', 'fx-cell-tide-poison-warn']);
    for (const f of ['deep', 'noble', null] as const) {
      expect(tideTail(f)).toBe('');
      expect(tideArtName(f)).toBe(art('fx-cell-tide') ? 'fx-cell-tide' : '');
    }
  });
});
