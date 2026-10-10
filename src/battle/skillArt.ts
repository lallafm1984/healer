/**
 * 보스 · 적 기술 아이콘 이름 (37 1장 · 4장 A·D·E·G, 44 4장 D, 47 4장 D). 대기열 · 기술 팝업 · 공략이 모두 여기서 찾는다.
 * 기믹 기술은 어느 보스든 같은 기믹 아이콘 icon-gim-* (37 1장: 대기열 아이콘만 보고 기믹을 알아보게),
 * 기믹이 아닌 기술 (버스터 · 광역 · 디버프)은 보스 고유 icon-bsk-<보스>-<n>, 구간 적 기술은 icon-mob-*.
 * 고르는 순서: 고유 그림 → 공용 기믹 그림 → 둘 다 없으면 '' (지금 그림 그대로). 영혼 · 쫄 부르기도 기믹 아이콘 (37 4장 E 「대기열 40px」)
 */
import { art } from '../art';
import { BOSSES, type AddDef, type AddJob, type DebuffDef, type SkillDef } from '../data/bosses';
import type { Encounter, ScriptKey } from '../data/encounters';
import type { BossSkill, Fight } from '../engine/types';

/** 기믹 아이콘 43장 (37 4장 A 1~23 · E 1~10 · G 1~3 · H 1~2, 52 보물 욕심 · 녹는 보호막 · 부화하는 알, 55 G 신기루 · 모래시계): icon-gim-<이름>. 모자 뽑기 모자 (H 3~5)는 칸 위 표식이라 대기열에 안 씀 */
export const GIMS = ['full', 'wound', 'hunt', 'link', 'invert', 'over', 'quake', 'recoil', 'gaze', 'drain', 'charm', 'order', 'jump', 'safe', 'tower', 'pull', 'hole',
  'stagger', 'counter', 'burst', 'soul', 'rot', 'notank', 'add', 'elite', 'mender', 'bomb', 'pylon', 'jail', 'march', 'fixate', 'focus', 'offtank', 'swell', 'cap', 'flip', 'grow', 'pass', 'greed', 'melt', 'hatch', 'mirage', 'glass'] as const;
export type Gim = (typeof GIMS)[number];
type BossKey = Exclude<ScriptKey, 'trash'>;

/** 보스 고유 아이콘 (37 4장 D, 44 4장 D 1~4, 47 4장 D 1~43, 49 4장 D 1~35, 52 4장 D): 보스 데이터 키 → 기술 키 → 그림. 탐험판은 던전 보스 그림을 같이 씀 (44 0장) */
const BSK: Partial<Record<BossKey, Record<string, string>>> = {
  collector3: { aoe: 'icon-bsk-collector-2' },
  collector: { buster: 'icon-bsk-collector-1', aoe: 'icon-bsk-collector-2' },
  malchor: { bless: 'icon-bsk-malchor-1', bless2: 'icon-bsk-malchor-1', smoke: 'icon-bsk-malchor-2', aoe: 'icon-bsk-malchor-3' },
  shaman8: { dart: 'icon-bsk-shaman-1' },
  shaman: { dart: 'icon-bsk-shaman-1' },
  toad: { buster: 'icon-bsk-toad-1', swallow: 'icon-bsk-toad-2', aoe: 'icon-bsk-toad-3' },
  seres: { buster: 'icon-bsk-seres-1', venom: 'icon-bsk-seres-2' },
  butler13: { buster: 'icon-bsk-butler-1' },
  butler: { buster: 'icon-bsk-butler-1', candle: 'icon-bsk-butler-2', bow: 'icon-bsk-butler-3', glove: 'icon-bsk-butler-4' },
  lady: { aoe: 'icon-bsk-lady-1' },
  belmore: { buster: 'icon-bsk-belmore-1', ring: 'icon-bsk-belmore-2', youth: 'icon-bsk-belmore-3' },
  golem18: { buster: 'icon-bsk-runegolem-1' },
  frostgolem: { buster: 'icon-bsk-runegolem-1', jail: 'icon-bsk-runegolem-2', core: 'icon-bsk-runegolem-3' },
  mage: { shards: 'icon-bsk-mage-1', storm: 'icon-bsk-mage-2', storm2: 'icon-bsk-mage-2' },
  shadow: { silence: 'icon-bsk-shadow-1', mark: 'icon-bsk-shadow-2' },
  guardian23: { dust: 'icon-bsk-guardian-2' },
  guardian: { buster: 'icon-bsk-guardian-1', dust: 'icon-bsk-guardian-2' },
  keeper28: { soap: 'icon-bsk-keeper-2' },
  keeper: { buster: 'icon-bsk-keeper-1', soap: 'icon-bsk-keeper-2' },
  sentinel: { buster: 'icon-bsk-sentinel-1', shout: 'icon-bsk-sentinel-2' },
  crystal: { buster: 'icon-bsk-crystal-1', detune: 'icon-bsk-crystal-2' },
  ratking: { buster: 'icon-bsk-ratking-1', cap: 'icon-bsk-ratking-2' },
  carrier: { buster: 'icon-bsk-carrier-1', aoe: 'icon-bsk-carrier-2' },
  librarian: { buster: 'icon-bsk-librarian-1', hush: 'icon-bsk-librarian-2' },
  librarian40: { buster: 'icon-bsk-librarian-1' },
  scholar: { buster: 'icon-bsk-scholar-1', aoe: 'icon-bsk-scholar-2', ice: 'icon-bsk-scholar-3' },
  priestess: { buster: 'icon-bsk-priestess-1', storm: 'icon-bsk-priestess-2', wilt: 'icon-bsk-priestess-3' },
  priestess48: { storm: 'icon-bsk-priestess-2' },
  sleeper: { buster: 'icon-bsk-sleeper-1', aoe: 'icon-bsk-sleeper-2' },
  // 짠물 해적단 (47 4장 D 15~43): 먹물 뿜기 · 소금물 저주는 치유 상한이라 그림이 없으면 icon-gim-cap, 동전 뒤집기는 기믹 아이콘 icon-gim-flip만
  crab36: { buster: 'icon-bsk-crab-1' },
  crab: { buster: 'icon-bsk-crab-1', wave: 'icon-bsk-crab-2' },
  cook: { buster: 'icon-bsk-cook-1', pepper: 'icon-bsk-cook-2', soup: 'icon-bsk-cook-3' },
  morel: { buster: 'icon-bsk-morel-1', wave: 'icon-bsk-morel-2', song: 'icon-bsk-morel-3' },
  gunner: { buster: 'icon-bsk-gunner-1', broadside0: 'icon-bsk-gunner-2', broadside0b: 'icon-bsk-gunner-2', broadside1: 'icon-bsk-gunner-2', broadside1b: 'icon-bsk-gunner-2', broadside2: 'icon-bsk-gunner-2', broadside2b: 'icon-bsk-gunner-2', deaf: 'icon-bsk-gunner-3' },
  octo: { buster: 'icon-bsk-octo-1', ink: 'icon-bsk-octo-2', ink2: 'icon-bsk-octo-2', wave: 'icon-bsk-octo-3' },
  seawitch: { buster: 'icon-bsk-seawitch-1', brine: 'icon-bsk-seawitch-2', tide: 'icon-bsk-seawitch-3', foam: 'icon-bsk-seawitch-4' },
  mimic: { buster: 'icon-bsk-mimic-1', gulp: 'icon-bsk-mimic-2', gulp2: 'icon-bsk-mimic-2', rain: 'icon-bsk-mimic-3' },
  parrot: { buster: 'icon-bsk-parrot-1', gust: 'icon-bsk-parrot-2', gust2: 'icon-bsk-parrot-2', mimicry: 'icon-bsk-parrot-3', flap: 'icon-bsk-parrot-4' },
  goldbeard44: { buster: 'icon-bsk-goldbeard-1' },
  goldbeard: { buster: 'icon-bsk-goldbeard-1', cannon0: 'icon-bsk-goldbeard-2', cannon1: 'icon-bsk-goldbeard-2', cannon2: 'icon-bsk-goldbeard-2', roar: 'icon-bsk-goldbeard-3', treasure: 'icon-bsk-goldbeard-4' },
  // 묶음 C (49 4장 D 1~14)
  sippy52: { buster: 'icon-bsk-sippy-1' },
  sippy: { buster: 'icon-bsk-sippy-1', hunt: 'icon-bsk-sippy-2', aoe: 'icon-bsk-sippy-3' },
  hatter: { buster: 'icon-bsk-hatter-1', quake: 'icon-bsk-hatter-2', aoe: 'icon-bsk-hatter-3' },
  uga: { buster: 'icon-bsk-uga-1', leech: 'icon-bsk-uga-2', aoe: 'icon-bsk-uga-3' },
  shellgod: { buster: 'icon-bsk-shellgod-1', spit: 'icon-bsk-shellgod-2', spit2: 'icon-bsk-shellgod-2', roll0: 'icon-bsk-shellgod-3', roll1: 'icon-bsk-shellgod-3', roll2: 'icon-bsk-shellgod-3' },
  kobold60: { buster: 'icon-bsk-kobold-1', smoke: 'icon-bsk-kobold-2' },
  queen56: { buster: 'icon-bsk-amanita-1' },
  songi: { buster: 'icon-bsk-songi-1', ticket: 'icon-bsk-songi-2', cough: 'icon-bsk-songi-3' },
  pililli: { buster: 'icon-bsk-pililli-1', band: 'icon-bsk-pililli-2' },
  ponga: { buster: 'icon-bsk-ponga-1', cloud: 'icon-bsk-ponga-2' },
  mungge: { buster: 'icon-bsk-mungge-1', rain: 'icon-bsk-mungge-2' },
  gaegul: { buster: 'icon-bsk-gaegul-1', croak: 'icon-bsk-gaegul-2', splash: 'icon-bsk-gaegul-3' },
  morak: { buster: 'icon-bsk-morak-1', water: 'icon-bsk-morak-2', storm: 'icon-bsk-morak-3' },
  bungbung: { buster: 'icon-bsk-bungbung-1', wind: 'icon-bsk-bungbung-2' },
  ppyong: { buster: 'icon-bsk-ppyong-1', vanish: 'icon-bsk-ppyong-2' },
  amanita: { buster: 'icon-bsk-amanita-1', waltz: 'icon-bsk-amanita-2' },
  // 묶음 D1 (52 4장 D 1~13). 연기 · 곡괭이는 꼬질 (49) 그림을 같이 씀
  mungsil64: { buster: 'icon-bsk-mungsil-1', steam: 'icon-bsk-mungsil-2', smoke: 'icon-bsk-kobold-2' },
  mungsil: { buster: 'icon-bsk-mungsil-1', steam: 'icon-bsk-mungsil-2', smoke: 'icon-bsk-kobold-2' },
  bulttung: { buster: 'icon-bsk-bulttung-1', fire0: 'icon-bsk-bulttung-2', fire1: 'icon-bsk-bulttung-2', fire2: 'icon-bsk-bulttung-2' },
  huggeun: { iron: 'icon-bsk-huggeun-1', ironm: 'icon-bsk-huggeun-1', spark: 'icon-bsk-huggeun-2', splash: 'icon-bsk-huggeun-3' },
  ttangttang: { buster: 'icon-bsk-ttangttang-1', sea: 'icon-bsk-ttangttang-2' },
  kkojil: { pick: 'icon-bsk-kobold-1', smoke: 'icon-bsk-kobold-2' },
  deolkeong: { cart: 'icon-bsk-deolkeong-1', cartm: 'icon-bsk-deolkeong-1', wheel: 'icon-bsk-deolkeong-2' },
  beonjjeok: { buster: 'icon-bsk-beonjjeok-1', rain: 'icon-bsk-beonjjeok-2' },
  // 묶음 D2 (52 4장 D 14~25). 단단이 줄 불길은 불퉁이 그림을 같이 씀
  whelps: { snort: 'icon-bsk-whelps-1' },
  dandani: {
    spear: 'icon-bsk-dandani-1', charge: 'icon-bsk-dandani-2',
    fire0: 'icon-bsk-bulttung-2', fire0b: 'icon-bsk-bulttung-2', fire1: 'icon-bsk-bulttung-2', fire1b: 'icon-bsk-bulttung-2', fire2: 'icon-bsk-bulttung-2', fire2b: 'icon-bsk-bulttung-2',
  },
  rubina: {
    buster: 'icon-bsk-rubina-1', showoff: 'icon-bsk-rubina-2', ash: 'icon-bsk-rubina-3',
    breath0: 'icon-bsk-rubina-4', breath0b: 'icon-bsk-rubina-4', breath1: 'icon-bsk-rubina-4', breath1b: 'icon-bsk-rubina-4', breath2: 'icon-bsk-rubina-4', breath2b: 'icon-bsk-rubina-4',
  },
  knights68: { wave: 'icon-bsk-knights-1' },
  knights: { wave: 'icon-bsk-knights-1' },
  uwoong: { drops: 'icon-bsk-uwoong-1' },
  ormal: { buster: 'icon-bsk-ormal-1', touch: 'icon-bsk-ormal-2', wave: 'icon-bsk-ormal-3' },
  // 묶음 E1 (55 4장 D). 모래 기침 · 천 년 졸음은 모래 왕국 공용, 깊은잠 그림자 손길은 오르말 그림을 같이 씀
  kkubeok: { cough: 'icon-bsk-sand-cough' },
  hokdol: { buster: 'icon-bsk-hokdol-1', haggle: 'icon-bsk-hokdol-2' },
  nyanx: { buster: 'icon-bsk-nyanx-1', sleepy: 'icon-bsk-sand-sleepy' },
  heumul: { tentacle: 'icon-bsk-heumul-1' },
  bichumi: { dust: 'icon-bsk-bichumi-1', fine: 'icon-bsk-bichumi-2' },
  gipeun: { buster: 'icon-bsk-gipeun-1', touch: 'icon-bsk-ormal-2', beat: 'icon-bsk-gipeun-2' },
  degul: { buster: 'icon-bsk-degul-1', roll: 'icon-bsk-degul-2', roll2: 'icon-bsk-degul-2', rollm: 'icon-bsk-degul-2', rollm2: 'icon-bsk-degul-2', cough: 'icon-bsk-sand-cough' },
  dooldool: { buster: 'icon-bsk-dooldool-1', wrap: 'icon-bsk-dooldool-2', wrap2: 'icon-bsk-dooldool-2', hush: 'icon-bsk-dooldool-3', sleepy: 'icon-bsk-sand-sleepy' },
  // 묶음 E2 (55 4장 D 15 ~ 22 · 33 ~ 37)
  solsol: { sting: 'icon-bsk-solsal-1', sting2: 'icon-bsk-solsal-1', sting3: 'icon-bsk-solsal-1', cough: 'icon-bsk-sand-cough' },
  eonggeum: { shell: 'icon-bsk-eonggeum-1', bog0: 'icon-bsk-eonggeum-2', bog1: 'icon-bsk-eonggeum-2', count: 'icon-bsk-eonggeum-3' },
  sarasha: { buster: 'icon-bsk-sarasha-1', fan: 'icon-bsk-sarasha-2', whirl: 'icon-bsk-sarasha-3', whirl2: 'icon-bsk-sarasha-3', sigh: 'icon-bsk-sarasha-4' },
  ttubeok: { press: 'icon-bsk-ttubeok-1', rise0: 'icon-bsk-ttubeok-2', rise1: 'icon-bsk-ttubeok-2', rise2: 'icon-bsk-ttubeok-2', rise3: 'icon-bsk-ttubeok-2' },
  toktok: { pollen: 'icon-bsk-toktok-1' },
  kungkung: { buster: 'icon-bsk-kungkung-1', beat: 'icon-bsk-gipeun-2' },
};
/** 데이터 부품만으로는 안 보이는 기믹 (35 4장 표): 서리 손길 · 빗자루 = 버스터 + 썩는 상처 (서리 · 먼지 범벅), 얼어붙는 바닥 · 바닥이 언다 = 장판 → 무너지는 바닥 */
const GIM_KEY: Partial<Record<BossKey, Record<string, Gim>>> = {
  shadow: { buster: 'rot', floor: 'hole' },
  keeper: { buster: 'rot' },
  scholar: { floor: 'hole', floor2: 'hole' },
  mungsil: { meltm: 'melt' }, // 악몽 「김 서림」 = 받는 치유 감소지만 녹는 보호막과 같이 옴
  gipeun: { deep0: 'hole' }, // 깊은 물 장판이 끝나면 가장자리가 구멍 (54 4-4)
};
/** 구간 적 기술 (44 4장 D 5~15, 47 4장 D 46): 「적 이름:공격 키」 → 그림. 독 혹 두꺼비는 부글이 그림을 같이 씀 (44 0장) */
const MOB: Record<string, string> = {
  '교단 신도:rot': 'icon-mob-rot',
  '부리 가면 집행자:shout': 'icon-mob-sick-shout',
  '독침 사냥꾼:sting': 'icon-mob-dart',
  '검은 베일 조문객:veil': 'icon-mob-veil',
  '유령 사냥개:howl': 'icon-mob-howl',
  '떠도는 주술서:silence': 'icon-mob-silence',
  '서리 정령:burst': 'icon-mob-frost-burst',
  '길 잃은 순례자:soap': 'icon-mob-pilgrim',
  '신전 돌거인:pound': 'icon-mob-ground-quake',
  '심연 전령:seal': 'icon-mob-trap',
  '탑 감시자:gaze': 'icon-mob-gaze',
  '납골당 관리인:dust': 'icon-mob-dust-sweep',
  '재채기 버섯:sneeze': 'icon-mob-sneeze', // 49 4장 D 36
  '해파리 점쟁이:fortune': 'icon-mob-jelly', // 47 4장 D 44 (닻 든 거한 닻 돌리기 45는 아직 데이터에 없음)
  '독 혹 두꺼비:burst': 'icon-bsk-toad-3',
  '용 비늘 경비병:tail': 'icon-mob-tail-sweep', // 52 4장 D 26
  '스핑크스 석상:storm': 'icon-mob-sandstorm', // 55 4장 D 45
};

/** 판 위 적이 하는 일 → 기믹 (37 4장 E 1~10) */
/** 꿀벌 떼 (sting, 48 4장)는 판 위 쫄, 부화하는 알 (51 5장)은 새 아이콘, 금화 더미 (51 4-1)는 보스를 키우는 수정 아이콘을 빌림 */
const ADD_GIM: Record<AddJob['p'], Gim> = { mend: 'mender', bomb: 'bomb', pylon: 'pylon', drain: 'drain', jail: 'jail', smash: 'elite', march: 'march', fixate: 'fixate', sting: 'add', hatch: 'hatch', hoard: 'pylon' };
function addGim(a: AddDef, tanks: number): Gim {
  if (a.job) return ADD_GIM[a.job.p];
  if (a.down?.p === 'burst') return 'burst'; // 쓰러질 때 파열 (쥐떼 · 늪 머리)
  return a.dmg > 0 && !a.cleave && tanks > 1 ? 'offtank' : 'add'; // 때리는 쫄은 탱커가 둘이면 부탱커가 끎 (35 3-I 3)
}
/** 디버프 → 기믹 (35 3장 · 3-J). 없으면 기믹이 아닌 디버프 */
function debuffGim(d: DebuffDef): Gim | undefined {
  if (d.cureAt != null) return d.cureAt >= 1 ? 'full' : 'wound';
  if (d.invert) return 'invert';
  if (d.charm) return 'charm';
  if (d.count) return 'recoil';
  if (d.drain) return 'drain';
  if (d.over) return 'over';
  if (d.swell || d.end?.p === 'pop') return 'swell';
  if (d.cap != null) return 'cap';
  if (d.end?.p === 'flip') return 'flip';
  if (d.end?.p === 'jump') return 'jump';
  if (d.end?.p === 'pass') return 'pass'; // 넘어가는 포자 (P-PASS, 37 4장 H-2)
  return undefined;
}
/** 기술 데이터 → 기믹 (35 3장 22종 · 3-I · 3-J). tanks = 탱커 수 (부탱커 끌기) */
export function gimOf(d: SkillDef, tanks = 1): Gim | undefined {
  const e = d.effect;
  if (d.mirage && e?.p !== 'order') return 'mirage'; // 신기루 (55 G 1). 수수께끼 (차례 × 신기루)는 차례 아이콘
  if (e?.p === 'glass') return 'glass'; // 모래시계 (55 G 2)
  if (!e) return d.cells?.p === 'safe' ? 'safe' : undefined;
  switch (e.p) {
    case 'hunt': case 'quake': case 'pull': case 'order': case 'link': case 'hole': case 'tower': case 'stagger': case 'counter': case 'soul': case 'jail': return e.p;
    case 'vessel': return 'over';
    case 'ring': return 'grow'; // 요정 고리 (P-GROW, 37 4장 H-1)
    case 'greed': case 'melt': return e.p; // 보물 욕심 · 녹는 보호막 (51 5장, 그림 52)
    case 'adds': return addGim(e.add, tanks);
    case 'debuff': case 'tank': case 'all': return e.debuff ? debuffGim(e.debuff) : undefined;
    default: return undefined;
  }
}

/** 후보 이름 (앞에서부터 있는 그림을 씀): 보스 고유 → 공용 기믹 */
export function bossSkillArtNames(script: BossKey, d: SkillDef, tanks = 1): string[] {
  const gim = GIM_KEY[script]?.[d.key] ?? gimOf(d, tanks);
  return [BSK[script]?.[d.key], gim && `icon-gim-${gim}`].filter((n): n is string => !!n);
}
const firstArt = (names: string[]): string => names.find(n => art(n)) ?? '';
/** 보스 기술 그림 이름 (공략 · 대기열). 없으면 '' */
export const bossSkillArt = (enc: Encounter, d: SkillDef): string => (enc.script === 'trash' ? '' : firstArt(bossSkillArtNames(enc.script, d, enc.comp.tank)));
/** 구간 적 기술 그림 이름. 없으면 '' */
export const mobSkillArt = (mob: string, attack: string): string => firstArt([MOB[`${mob}:${attack}`]].filter((n): n is string => !!n));
/** 기믹 그림 이름 (판 위 표식 · 구간 쫄 파열). 없으면 '' */
export const gimArt = (g: Gim): string => firstArt([`icon-gim-${g}`]);
/** 전투 중 기술 (대기열 · 팝업). 구간 적 기술 키 = 공격 키 + 적 id (engine/bosses.ts initTrash) */
export function fightSkillArt(f: Fight, s: BossSkill): string {
  if (s.mob != null) {
    const m = f.mobs.find(x => x.id === s.mob);
    return m ? mobSkillArt(m.name, s.key.slice(0, -String(s.mob).length)) : '';
  }
  if (f.enc.script === 'trash') return '';
  const d = BOSSES[f.enc.script].skills.find(x => x.key === s.key);
  return d ? bossSkillArt(f.enc, d) : '';
}
/** 그림 이름 → <img> (없으면 '') */
export function skillArtImg(name: string): string {
  const src = name ? art(name) : '';
  return src ? `<img src="${src}" alt="" decoding="async" draggable="false">` : '';
}
/** 표 확인용 (테스트): 고유 · 구간 적 그림 이름 모두 */
export const SKILL_ART_TABLE = { bsk: BSK, gim: GIM_KEY, mob: MOB } as const;
