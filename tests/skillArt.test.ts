/** 보스 · 적 기술 아이콘 이름 (37 1장 · 4장 A·D·E·G, 44 4장 D, 47 4장 D) */
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { art } from '../src/art';
import { BOSSES, type SkillDef } from '../src/data/bosses';
import { ENCOUNTERS, type EncounterKey, type ScriptKey } from '../src/data/encounters';
import * as E from '../src/engine';
import { bossSkillArt, bossSkillArtNames, fightSkillArt, GIMS, mobSkillArt, SKILL_ART_TABLE } from '../src/battle/skillArt';

// 문서 파일 이름 (그림 요청 문서 표 그대로)
/** 37 4장 A 1~23 · E 1~10 · G 1~3 · H 1~2, 52 4장 A (묶음 D 보물 욕심 · 녹는 보호막 · 부화하는 알), 55 4장 G 1~2 (묶음 E 신기루 · 모래시계), 57 4장 G 1~2 (묶음 F 띄워 올리기 · 연쇄 번개), 60 4장 G 1~2 (묶음 G 어둠물 밀물 · 빌린 생명) */
const DOC_GIM = ['full', 'wound', 'hunt', 'link', 'invert', 'over', 'quake', 'recoil', 'gaze', 'drain', 'charm', 'order', 'jump', 'safe', 'tower', 'pull', 'hole', 'stagger',
  'counter', 'burst', 'soul', 'rot', 'notank', 'add', 'elite', 'mender', 'bomb', 'pylon', 'jail', 'march', 'fixate', 'focus', 'offtank', 'swell', 'cap', 'flip', 'grow', 'pass',
  'greed', 'melt', 'hatch', 'mirage', 'glass', 'lift', 'chain', 'tide', 'debt', 'pulse', 'beat'].map(n => `icon-gim-${n}`);
/** 37 4장 D (던전 ② ~ ⑥), 44 4장 D 1~4 (던전 ⑦), 47 4장 D 1~43 (묶음 B), 49 4장 D 1~35 (묶음 C), 52 4장 D 1~25 (묶음 D), 55 4장 D (묶음 E1 · E2 보스만), 57 4장 D (묶음 F), 60 4장 D (묶음 G): 보스 → 장 수 */
const DOC_BSK_N: Record<string, number> = {
  collector: 2, malchor: 3, shaman: 1, toad: 3, seres: 2, butler: 4, lady: 1, belmore: 3, runegolem: 3, mage: 2, shadow: 2, guardian: 2, keeper: 2,
  sentinel: 2, crystal: 2, ratking: 2, carrier: 2, librarian: 2, scholar: 3, priestess: 3, sleeper: 2,
  crab: 2, cook: 3, morel: 3, gunner: 3, octo: 3, seawitch: 4, mimic: 3, parrot: 4, goldbeard: 4,
  sippy: 3, hatter: 3, uga: 3, shellgod: 3, kobold: 2, songi: 3, pililli: 2, ponga: 2, mungge: 2, gaegul: 3, morak: 3, bungbung: 2, ppyong: 2, amanita: 2,
  mungsil: 2, bulttung: 2, huggeun: 3, ttangttang: 2, deolkeong: 2, beonjjeok: 2,
  whelps: 1, dandani: 2, rubina: 4, knights: 1, uwoong: 1, ormal: 3,
  degul: 2, dooldool: 3, hokdol: 2, nyanx: 1, heumul: 1, bichumi: 2, gipeun: 2,
  solsal: 1, eonggeum: 3, sarasha: 4, ttubeok: 2, toktok: 1, kungkung: 1,
  stargazer: 2, geuneul: 2, poksin: 2, jjaekkak: 1, hapum: 3, ttakttak: 1, jjirit: 2, doeul: 2, hwirik: 3,
  chulleong: 2, puseok: 2, huu: 2, kkongkkong: 2, buri: 2, boksul: 3, dolgae: 1,
  gulgul: 3, pingping: 2, bitgallae: 2, dungdung: 2, ssaengssaeng: 3, ureureung: 3, pongpong: 2, dwijuk: 2, kwangkwang: 1, syungsyung: 2, eodugi: 3,
  geumeum: 3, silta: 2, bamgeuneul: 2, jilpung: 3, ureobal: 3, chilheuk: 3, serena: 3, valen: 2,
  janmul: 3, hwigami: 3, geomeun: 2, nokseul: 2,
  eongkim: 2, revlord: 2, abyssheart: 2, lastshade: 3,
};
/** 55 4장 D 1~2: 모래 왕국 공용 (모래 기침 · 천 년 졸음), 57 4장 D: 구름 위 섬 공용 (깃털 간지럼) */
const DOC_BSK = [...Object.entries(DOC_BSK_N).flatMap(([b, n]) => Array.from({ length: n }, (_, i) => `icon-bsk-${b}-${i + 1}`)), 'icon-bsk-sand-cough', 'icon-bsk-sand-sleepy', 'icon-bsk-sky-tickle'];
/** 44 4장 D 5~15, 47 4장 D 44~46, 49 4장 D 36, 52 4장 D 26, 55 4장 D 45, 57 4장 D (천둥 숫양 · 번개 실험 정령) */
const DOC_MOB = ['rot', 'sick-shout', 'dart', 'veil', 'howl', 'silence', 'frost-burst', 'pilgrim', 'ground-quake', 'trap', 'gaze', 'jelly', 'anchor-spin', 'dust-sweep', 'sneeze', 'tail-sweep', 'sandstorm', 'thunder-charge', 'spark-burst', 'trap-hex', 'root-slam'].map(n => `icon-mob-${n}`);
/** 모자 뽑기 모자 (37 4장 H 3~5): 칸 위 표식 (대기열 기믹 표에는 없음) */
const DOC_HAT = ['full', 'invert', 'cap'].map(n => `icon-gim-hat-${n}`);
const DOC = new Set([...DOC_GIM, ...DOC_HAT, ...DOC_BSK, ...DOC_MOB]);
/** 아직 데이터에 없는 적 (47 4장 D 45 닻 든 거한은 다음 해적 장소 몫) */
const NOT_IN_DATA = /^icon-mob-anchor-spin$/;

type BossKey = Exclude<ScriptKey, 'trash'>;
const OK_NAME =/^icon-(gim|bsk|mob)-[a-z0-9-]+$/;
/** 기믹 부품인지 (35 3장 22종 · 3-I · 3-J): 엔진 부품 · 디버프 표시로 따로 판단 */
const GIM_P = new Set(['hunt', 'quake', 'pull', 'order', 'link', 'hole', 'tower', 'stagger', 'counter', 'soul', 'jail', 'vessel', 'adds', 'ring', 'greed', 'melt', 'glass', 'lift', 'chain']);
function isGimmick(d: SkillDef): boolean {
  const e = d.effect;
  if (d.mirage) return true; // 신기루 (54 5장)
  if (!e) return d.cells?.p === 'safe' || d.cells?.p === 'tide';
  if (GIM_P.has(e.p)) return true;
  const x = 'debuff' in e ? e.debuff : undefined;
  return !!x && (x.cureAt != null || !!x.debt || !!x.invert || !!x.charm || !!x.count || !!x.drain || !!x.over || !!x.swell || x.cap != null || ['jump', 'flip', 'pop', 'pass'].includes(x.end?.p ?? ''));
}
const bossEncs = Object.values(ENCOUNTERS).filter(e => e.script !== 'trash');
const trashEncs = Object.values(ENCOUNTERS).filter(e => e.mobs);

describe('기술 아이콘 이름', () => {
  it('모든 보스 기술: 그림 이름이 없거나 icon-gim- · icon-bsk- · icon-mob-', () => {
    for (const enc of bossEncs) for (const d of BOSSES[enc.script as BossKey].skills) {
      const name = bossSkillArt(enc, d);
      expect(name === '' || OK_NAME.test(name), `${enc.key}.${d.key} → ${name}`).toBe(true);
      if (name) expect(art(name), name).not.toBe('');
    }
  });

  it('기믹 기술은 공용 기믹 아이콘 (37 1장): 고유 그림이 없으면 icon-gim-', () => {
    let n = 0;
    for (const enc of bossEncs) {
      const script = enc.script as BossKey;
      for (const d of BOSSES[script].skills) {
        if (!isGimmick(d)) continue;
        n++;
        const names = bossSkillArtNames(script, d, enc.comp.tank), gim = names.find(x => x.startsWith('icon-gim-'));
        expect(gim && DOC_GIM.includes(gim), `${enc.key}.${d.key} → ${names}`).toBe(true);
        if (!names[0].startsWith('icon-bsk-')) expect(bossSkillArt(enc, d)).toBe(art(gim!) ? gim : '');
      }
    }
    expect(n).toBeGreaterThan(40);
  });

  it('부품 → 기믹 아이콘 (37 4장 A · E)', () => {
    const one = (k: EncounterKey, skill: string) => {
      const enc = ENCOUNTERS[k], script = enc.script as BossKey;
      return bossSkillArtNames(script, BOSSES[script].skills.find(s => s.key === skill)!, enc.comp.tank);
    };
    expect(one('shaman', 'leech')).toEqual(['icon-gim-full']);
    expect(one('malchor', 'pulse')).toEqual(['icon-gim-wound']);
    expect(one('toad', 'belly')).toEqual(['icon-gim-safe']);
    expect(one('seres', 'spirit')).toEqual(['icon-gim-soul']);
    expect(one('lady', 'frames')).toEqual(['icon-gim-pylon']);
    expect(one('belmore', 'invert')).toEqual(['icon-gim-invert']);
    expect(one('priestess', 'vessel')).toEqual(['icon-gim-over']);
    expect(one('carrier', 'barrel')).toEqual(['icon-gim-march']);
    expect(one('carrier', 'bless')).toEqual(['icon-gim-jump']);
    expect(one('librarian', 'books')).toEqual(['icon-gim-drain']);
    expect(one('ratking', 'rats')).toEqual(['icon-gim-burst']);
    expect(one('hydra', 'mender')).toEqual(['icon-gim-mender']);
    expect(one('abysslord', 'jail')).toEqual(['icon-gim-jail']);
    expect(one('shadow', 'buster')).toEqual(['icon-gim-rot']); // 35 4-4 ③ 서리 손길 = P-TANK + P-ROT
    expect(one('keeper', 'buster')).toEqual(['icon-bsk-keeper-1', 'icon-gim-rot']);
    expect(one('mage', 'shards')).toEqual(['icon-bsk-mage-1', 'icon-gim-hunt']); // 37 4장 D-23 고유, 없으면 사냥
    expect(one('collector', 'buster')).toEqual(['icon-bsk-collector-1']);
    expect(one('sentinel', 'chain')).toEqual(['icon-gim-pull']); // 44 0장
    expect(one('crystal', 'echo')).toEqual(['icon-gim-jump']);
    expect(one('warden', 'buster')).toEqual([]);
    expect(one('kkubeok', 'spear')).toEqual(['icon-gim-mirage']); // 55 4장 G
    expect(one('hokdol', 'pile')).toEqual(['icon-gim-mirage']);
    expect(one('nyanx', 'riddle')).toEqual(['icon-gim-order']); // 차례 × 신기루는 차례
    expect(one('nyanx', 'tail')).toEqual(['icon-gim-mirage']);
    expect(one('degul', 'glass')).toEqual(['icon-gim-glass']);
    expect(one('dooldool', 'glassm')).toEqual(['icon-gim-glass']);
    expect(one('eonggeum', 'ram')).toEqual(['icon-gim-mirage']); // 탱커 버스터 × 신기루
    expect(one('solsol', 'chain')).toEqual(['icon-gim-link']);
    expect(one('sarasha', 'glass')).toEqual(['icon-gim-glass']);
    expect(one('ttubeok', 'pull')).toEqual(['icon-gim-pull']);
    expect(one('kungkung', 'flip')).toEqual(['icon-gim-flip']);
  });

  it('구간 적 기술: 그림 이름이 없거나 icon-mob- · icon-bsk-', () => {
    for (const enc of trashEncs) for (const m of enc.mobs!) for (const a of m.attacks) {
      const name = mobSkillArt(m.name, a.key);
      expect(name === '' || OK_NAME.test(name), `${enc.key} ${m.name}.${a.key} → ${name}`).toBe(true);
    }
    expect(mobSkillArt('교단 신도', 'rot')).toBe(art('icon-mob-rot') ? 'icon-mob-rot' : '');
    expect(mobSkillArt('교단 신도', 'hit')).toBe('');
  });

  it('전투 중 대기열 기술도 같은 이름 (구간 적 기술 키 = 공격 키 + 적 id)', () => {
    for (const enc of Object.values(ENCOUNTERS)) {
      const f = E.create({ encounter: enc.key, diff: '보통', seed: 1 });
      for (const s of f.skills) {
        const name = fightSkillArt(f, s);
        if (s.mob != null) {
          const m = f.mobs.find(x => x.id === s.mob)!, def = enc.mobs!.find(x => x.name === m.name)!;
          const a = def.attacks.find(x => `${x.key}${m.id}` === s.key)!;
          expect(name, s.key).toBe(mobSkillArt(m.name, a.key));
        } else if (enc.script !== 'trash') {
          const d = BOSSES[enc.script].skills.find(x => x.key === s.key);
          expect(name, `${enc.key}.${s.key}`).toBe(d ? bossSkillArt(enc, d) : '');
        }
      }
      for (const q of E.queue(f)) expect(q.skill).toBeDefined();
    }
  });

  it('표의 그림 이름은 문서 파일 이름 · 표의 키는 데이터에 있음', () => {
    expect([...GIMS].map(n => `icon-gim-${n}`).sort()).toEqual([...DOC_GIM].sort());
    const used = new Set<string>();
    for (const [script, row] of Object.entries(SKILL_ART_TABLE.bsk)) for (const [key, name] of Object.entries(row!)) {
      expect(DOC.has(name), name).toBe(true);
      expect(BOSSES[script as BossKey].skills.some(s => s.key === key), `${script}.${key}`).toBe(true);
      used.add(name);
    }
    for (const [script, row] of Object.entries(SKILL_ART_TABLE.gim)) for (const key of Object.keys(row!)) {
      expect(BOSSES[script as BossKey].skills.some(s => s.key === key), `${script}.${key}`).toBe(true);
    }
    for (const [k, name] of Object.entries(SKILL_ART_TABLE.mob)) {
      const [mob, key] = k.split(':');
      expect(DOC.has(name), name).toBe(true);
      expect(trashEncs.some(e => e.mobs!.some(m => m.name === mob && m.attacks.some(a => a.key === key))), k).toBe(true);
      used.add(name);
    }
    // 데이터에 있는 보스 · 적의 문서 아이콘은 모두 표에 있음
    for (const name of [...DOC_BSK, ...DOC_MOB]) if (!NOT_IN_DATA.test(name)) expect(used.has(name), name).toBe(true);
  });

  it('받은 기술 아이콘 파일은 문서 이름', () => {
    const files = readdirSync(new URL('../src/art', import.meta.url)).map(f => f.replace(/\.\w+$/, '')).filter(n => /^icon-(gim|bsk|mob)-/.test(n));
    for (const n of files) expect(DOC.has(n), n).toBe(true);
  });
});
