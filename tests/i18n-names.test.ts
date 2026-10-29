/**
 * 이름 사전 검사 (기획 121 3단계 ①): 데이터 (data/*) 이름 글마다 영어 · 일본어 사전 (names-en · names-ja, 또는 UI 사전) 에 번역이 있는지.
 * 이름 사전과 UI 사전의 열쇠는 겹치지 않는다 (겹치면 한쪽이 묻힘). 다른 뜻으로 겹치는 이름은 '@ctx' 열쇠 (skill · talent · class · pers · ab · affix · spec · grade · look).
 */
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en';
import ja from '../src/i18n/ja';
import enNames from '../src/i18n/names-en';
import jaNames from '../src/i18n/names-ja';
import enPlaces from '../src/i18n/places-en';
import jaPlaces from '../src/i18n/places-ja';
import enEnemies from '../src/i18n/enemies-en';
import jaEnemies from '../src/i18n/enemies-ja';
import { FACTIONS, PLACES } from '../src/data/places';
import { CONTENT } from '../src/data/content';
import { ADVENTURE_REGIONS } from '../src/data/adventure-regions';
import { MOB_LOOKS } from '../src/data/mob-looks';
import { SKILL_INFO, SKILLS } from '../src/data/skills';
import { TALENT_TREES } from '../src/data/talents';
import { HEROES } from '../src/data/heroes';
import { CLASSES } from '../src/data/classes';
import { GRADE_STYLE, KINDS, LOOK_WORD, SLOTS, STATS } from '../src/data/equipment';
import { AB_KIND, ABILITIES } from '../src/data/abilities';
import { CATS, PERS } from '../src/data/personalities';
import { AFFIXES } from '../src/data/affixes';
import { DAILY, WEEKLY } from '../src/data/missions';
import { ENCOUNTERS } from '../src/data/encounters';
import { SPEC_GROUPS } from '../src/data/specials';
import { DEED_WHY } from '../src/data/guild';
import { MILESTONES } from '../src/data/milestones';
import { GROW_TYPES, STAT_HELP, STAT_NAMES } from '../src/data/fm';

const CTX = ['skill', 'talent', 'class', 'pers', 'ab', 'affix', 'spec', 'grade', 'look', 'kind', 'tab', 'bag', 'short'];
type Dict = Record<string, string>;
/** 이름 하나가 사전에 있는가 (그대로 · ctx 열쇠) */
const has = (ui: Dict, names: Dict, key: string, ctx?: string) => (ctx ? `${key}@${ctx}` in names || `${key}@${ctx}` in ui : false) || key in names || key in ui || CTX.some(c => `${key}@${c}` in names || `${key}@${c}` in ui);

/** 갈래마다 [이름, ctx] */
function dataNames(): [string, string | undefined][] {
  const out: [string, string | undefined][] = [];
  const add = (s: string | undefined, ctx?: string) => { if (s && /[가-힣]/.test(s)) out.push([s, ctx]); };
  for (const s of Object.values(SKILLS)) { add(s.name, 'skill'); add(s.short, 'skill'); }
  for (const b of Object.values(SKILL_INFO)) add(b.kind, 'kind');
  for (const g of GROW_TYPES) { add(g.type); add(g.desc); }
  for (const tree of Object.values(TALENT_TREES)) for (const tier of tree) { add(tier.theme); for (const p of tier.picks) { add(p.name, 'talent'); add(p.active?.short, 'talent'); } }
  for (const h of Object.values(HEROES)) { add(h.name); add(h.line); add(h.system?.name); for (const p of h.passives ?? []) add(p.name); add(h.unlock?.how); add(h.unlock?.quest?.name); }
  for (const c of Object.values(CLASSES)) { add(c.name, 'class'); add(c.short, 'class'); add(c.line); }
  for (const s of SLOTS) add(s.name); for (const s of Object.values(STATS)) add(s.name); for (const k of KINDS) add(k.name);
  for (const g of Object.values(GRADE_STYLE)) add(g.word, 'grade'); for (const w of Object.values(LOOK_WORD)) add(w, 'look');
  for (const k of Object.values(AB_KIND)) add(k.name); for (const a of Object.values(ABILITIES)) { add(a.name, 'ab'); add(a.when); }
  for (const n of Object.keys(PERS)) add(n, 'pers'); for (const c of Object.keys(CATS)) add(c);
  for (const a of Object.values(AFFIXES)) add(a.name, 'affix');
  for (const m of [...DAILY, ...WEEKLY]) add(m.text);
  for (const e of Object.values(ENCOUNTERS)) { add(e.tier); add(e.name); for (const m of e.mobs ?? []) add(m.name); }
  for (const f of Object.values(FACTIONS)) add(f.name); for (const p of Object.values(PLACES)) add(p.name);
  for (const r of ADVENTURE_REGIONS) { add(r.name); add(r.shortName); }
  for (const c of CONTENT) { add(c.name); add(c.place); for (const b of c.bosses ?? []) add(b); }
  for (const [k, looks] of Object.entries(MOB_LOOKS)) { add(k); for (const l of looks) add(l.name); }
  for (const g of Object.values(SPEC_GROUPS)) add(g.name, 'spec');
  for (const w of Object.values(DEED_WHY)) add(w);
  for (const list of Object.values(MILESTONES)) for (const m of list) add(m.tpl ?? m.text); // arg (장소 이름) 는 다음 묶음
  for (const v of Object.values(STAT_NAMES)) add(v); for (const v of Object.values(STAT_HELP)) add(v);
  return out;
}

describe('이름 사전 (121 3단계 ①)', () => {
  const list = dataNames();
  it('데이터 이름이 300개 넘게 모인다', () => { expect(list.length).toBeGreaterThan(300); });
  const enAll = { ...enNames, ...enPlaces, ...enEnemies }, jaAll = { ...jaNames, ...jaPlaces, ...jaEnemies };
  for (const [lang, ui, names, parts] of [['en', en, enAll, [enNames, enPlaces, enEnemies]], ['ja', ja, jaAll, [jaNames, jaPlaces, jaEnemies]]] as const) {
    it(`${lang}: 모든 데이터 이름에 번역이 있다 (보스 기술 · 특수능력은 다음 묶음)`, () => {
      const miss = [...new Set(list.filter(([k, c]) => !has(ui, names, k, c)).map(([k, c]) => (c ? `${k} (@${c})` : k)))];
      expect(miss).toEqual([]);
    });
    it(`${lang}: 이름 사전끼리 · UI 사전과 열쇠가 겹치지 않는다`, () => {
      expect(Object.keys(names).filter(k => k in ui)).toEqual([]);
      const seen = new Map<string, number>();
      parts.forEach((d, i) => { for (const k of Object.keys(d)) { if (seen.has(k)) expect.fail(`${k}: 사전 ${seen.get(k)}과 ${i}에 둘 다 있음`); seen.set(k, i); } });
    });
    it(`${lang}: 이름 사전 값에 한국어가 남지 않고 자리값이 열쇠와 같다`, () => {
      const bad = Object.entries(names).filter(([k, v]) => /[가-힣]/.test(v) || (k.match(/\{\w+\}/g) ?? []).sort().join() !== (v.match(/\{\w+\}/g) ?? []).sort().join());
      expect(bad).toEqual([]);
    });
  }
  it('이름 사전 열쇠는 영어 · 일본어가 같다', () => {
    expect(Object.keys(enAll).filter(k => !(k in jaAll))).toEqual([]);
    expect(Object.keys(jaAll).filter(k => !(k in enAll))).toEqual([]);
  });
});
