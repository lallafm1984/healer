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
import enBossSkills from '../src/i18n/boss-skills-en';
import jaBossSkills from '../src/i18n/boss-skills-ja';
import enBossParts from '../src/i18n/boss-parts-en';
import jaBossParts from '../src/i18n/boss-parts-ja';
import enGear from '../src/i18n/gear-en';
import jaGear from '../src/i18n/gear-ja';
import enDesc from '../src/i18n/desc-en';
import jaDesc from '../src/i18n/desc-ja';
import { UNIQUES } from '../src/data/uniques';
import { BOSSES } from '../src/data/bosses';
import { FACTIONS, PLACES } from '../src/data/places';
import { CONTENT } from '../src/data/content';
import { ADVENTURE_REGIONS } from '../src/data/adventure-regions';
import { MOB_LOOKS } from '../src/data/mob-looks';
import { PASSIVE_DESC, SKILL_INFO, SKILLS } from '../src/data/skills';
import { TALENT_TREES } from '../src/data/talents';
import { HEROES } from '../src/data/heroes';
import { CLASSES } from '../src/data/classes';
import { GRADE_STYLE, KINDS, LOOK_WORD, SLOTS, STATS } from '../src/data/equipment';
import { AB_KIND, ABILITIES } from '../src/data/abilities';
import { CATS, PERS } from '../src/data/personalities';
import { AFFIXES } from '../src/data/affixes';
import { DAILY, WEEKLY } from '../src/data/missions';
import { ENCOUNTERS } from '../src/data/encounters';
import { NAMED, SPEC_GROUPS, SPECS } from '../src/data/specials';
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
  for (const b of Object.values(SKILL_INFO)) { add(b.kind, 'kind'); add(b.desc); }
  for (const d of Object.values(PASSIVE_DESC)) add(d);
  for (const g of GROW_TYPES) { add(g.type); add(g.desc); }
  for (const tree of Object.values(TALENT_TREES)) for (const tier of tree) { add(tier.theme); for (const p of tier.picks) { add(p.name, 'talent'); add(p.active?.short, 'talent'); add(p.desc); } }
  for (const h of Object.values(HEROES)) { add(h.name); add(h.line); add(h.system?.name); add(h.system?.desc); for (const p of h.passives ?? []) { add(p.name); add(p.desc); } add(h.unlock?.how); add(h.unlock?.quest?.name); add(h.unlock?.quest?.text); }
  for (const c of Object.values(CLASSES)) { add(c.name, 'class'); add(c.short, 'class'); add(c.line); }
  for (const s of SLOTS) add(s.name); for (const s of Object.values(STATS)) add(s.name); for (const k of KINDS) add(k.name);
  for (const g of Object.values(GRADE_STYLE)) add(g.word, 'grade'); for (const w of Object.values(LOOK_WORD)) add(w, 'look');
  for (const k of Object.values(AB_KIND)) add(k.name); for (const a of Object.values(ABILITIES)) { add(a.name, 'ab'); add(a.when); add(a.desc); }
  for (const [n, p] of Object.entries(PERS)) { add(n, 'pers'); add(p.desc); } for (const c of Object.keys(CATS)) add(c);
  for (const a of Object.values(AFFIXES)) { add(a.name, 'affix'); add(a.desc); add(a.tip); }
  for (const m of [...DAILY, ...WEEKLY]) add(m.text);
  for (const f of Object.values(FACTIONS)) add(f.name); for (const p of Object.values(PLACES)) add(p.name);
  for (const r of ADVENTURE_REGIONS) { add(r.name); add(r.shortName); }
  for (const c of CONTENT) { add(c.name); add(c.place); add(c.tip); for (const b of c.bosses ?? []) add(b); }
  for (const [k, looks] of Object.entries(MOB_LOOKS)) { add(k); for (const l of looks) add(l.name); }
  // 보스 데이터: name · short · phase 글, 영혼 성공 · 실패 text, 흐름 글 (flow text, 공략 진행 줄 ⑤-b). 아이콘 글자 (icon) · 설명 (how · tip) 은 빼고
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'string') { const last = path.split('.').pop(); if ((last === 'name' || last === 'short' || last === 'phase' || (last === 'text' && (/\.(win|fail)$/.test(path.slice(0, -5)) || /flow\.do\.text$/.test(path)))) && !/\bhow\b/.test(path)) add(v); }
    else if (Array.isArray(v)) v.forEach(x => walk(x, path));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  for (const b of Object.values(BOSSES)) walk(b, 'boss');
  for (const e of Object.values(ENCOUNTERS)) { add(e.tier); add(e.name); walk(e.mobs ?? [], 'enc.mobs'); } // 구간 적 이름 · 공격 이름 · 디버프 (공략 시트, ⑤-b)
  for (const g of Object.values(SPEC_GROUPS)) add(g.name, 'spec');
  for (const s of Object.values(SPECS)) { add(s.name); add(s.text); }
  for (const n of NAMED) { add(n.name); add(n.text); add(n.placeName); }
  for (const u of UNIQUES) { add(u.name); add(u.placeName); }
  for (const w of Object.values(DEED_WHY)) add(w);
  for (const list of Object.values(MILESTONES)) for (const m of list) add(m.tpl ?? m.text); // arg (장소 이름) 는 다음 묶음
  for (const v of Object.values(STAT_NAMES)) add(v); for (const v of Object.values(STAT_HELP)) add(v);
  return out;
}

describe('이름 사전 (121 3단계 ①)', () => {
  const list = dataNames();
  it('데이터 이름이 300개 넘게 모인다', () => { expect(list.length).toBeGreaterThan(300); });
  const enAll = { ...enNames, ...enPlaces, ...enEnemies, ...enBossSkills, ...enBossParts, ...enGear, ...enDesc }, jaAll = { ...jaNames, ...jaPlaces, ...jaEnemies, ...jaBossSkills, ...jaBossParts, ...jaGear, ...jaDesc };
  for (const [lang, ui, names, parts] of [['en', en, enAll, [enNames, enPlaces, enEnemies, enBossSkills, enBossParts, enGear, enDesc]], ['ja', ja, jaAll, [jaNames, jaPlaces, jaEnemies, jaBossSkills, jaBossParts, jaGear, jaDesc]]] as const) {
    it(`${lang}: 모든 데이터 이름 · 효과 글 · 설명에 번역이 있다`, () => {
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
