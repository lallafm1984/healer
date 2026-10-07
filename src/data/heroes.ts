/**
 * 힐러 직업 (25 문서). P2는 사제·드루이드·성기사 3종.
 * 휠 8칸 구조와 배우는 레벨 순서는 모든 직업이 같고, 칸에 들어가는 스킬과 고유 시스템만 다르다 (25 2장).
 */
import type { DiffName } from './difficulty';
import { SKILLS, type SkillKey, type SlotName } from './skills';

export type HeroKey = 'priest' | 'druid' | 'paladin';

export interface HeroPassive { name: string; lv: number; desc: string }

/** 직업 퀘스트 (25 5-4): 그 직업으로 조건을 채우면 해금. content가 없으면 아무 던전 */
export interface HeroQuest { name: string; text: string; need: number; content?: string; minDiff?: DiffName }

/** 직업 바꾸기가 열리는 레벨 (25 4-1: 특성 1단과 함께) */
export const HERO_SWITCH_LV = 10;

export interface HeroDef {
  key: HeroKey;
  name: string;
  /** 한 줄 소개 */
  line: string;
  /** 손맛 난이도 ★ 개수 */
  star: number;
  /** 고유 시스템 이름·설명 (Lv 6) */
  system: { name: string; lv: number; desc: string };
  /** 지울 수 있는 디버프 */
  dispel: string[];
  /** 칸 → 스킬. unique(8번째 칸)가 없는 직업은 null */
  slots: Record<SlotName, SkillKey | null>;
  /** 칸 탭 기본 힐 후보 (캐릭터 → 스킬에서 고름) */
  tap: SkillKey[];
  passives: HeroPassive[];
  /** 해금 (25 5-4) */
  unlock: { lv: number; how: string; quest?: HeroQuest };
}

const slots = (o: Partial<Record<SlotName, SkillKey>>): Record<SlotName, SkillKey | null> => ({
  basic: null, fast: null, hot: null, aoe: null, dispel: null, ext: null, raid: null, unique: null, ...o,
});

export const HEROES: Record<HeroKey, HeroDef> = {
  priest: {
    key: 'priest', name: '사제', line: '꾸준히 넣으면 큰 한 방이 차오릅니다.', star: 1,
    system: { name: '성언 게이지', lv: 6, desc: '힐을 할 때마다 평온·신성화 게이지가 찹니다. 100%가 되면 휠 조각이 성언으로 바뀝니다.' },
    dispel: ['마법', '질병'],
    slots: slots({ basic: 'heal', fast: 'flash', hot: 'renew', aoe: 'poh', dispel: 'purify', ext: 'guardian', raid: 'hymn' }),
    tap: ['heal', 'flash', 'renew'],
    passives: [
      { name: '메아리 치유', lv: 1, desc: '치유·순간 치유·평온 힐량의 15%를 4초에 걸쳐 추가로 회복합니다.' },
      { name: '빛의 은총', lv: 4, desc: '소생이 걸린 대상에게 하는 직접 힐이 10% 늘어납니다.' },
      { name: '상징', lv: 10, desc: '전투마다 한 번, 마나가 30% 아래로 내려가면 5초 동안 마나 회복이 4배가 됩니다.' },
    ],
    unlock: { lv: 1, how: '처음부터' },
  },
  druid: {
    key: 'druid', name: '드루이드', line: '위기 전에 미리 깔아 두는 힐러입니다.', star: 2,
    system: { name: '군락', lv: 6, desc: '새싹이 걸린 칸끼리 붙어 있으면 붙은 칸 하나마다 새싹 회복이 10%씩, 최대 30%까지 늘어납니다.' },
    dispel: ['마법', '저주', '독'],
    slots: slots({ basic: 'sprout', fast: 'growth', hot: 'bloom', aoe: 'wildflower', dispel: 'natureCleanse', ext: 'bark', raid: 'quietwood', unique: 'rebirth' }),
    tap: ['sprout', 'growth', 'bloom'],
    passives: [
      { name: '뿌리 깊음', lv: 4, desc: '지속 힐이 2개 이상 걸린 대상에게 하는 직접 힐이 10% 늘어납니다.' },
      { name: '순환', lv: 10, desc: '새싹이 끝까지 다 차면 마나를 0.4% 돌려받습니다.' },
    ],
    unlock: { lv: 10, how: 'Lv 10 직업 퀘스트 「숲의 부름」', quest: { name: '숲의 부름', text: '드루이드로 녹슨 요새 보통 이상 클리어', need: 1, content: 'rustfort', minDiff: '보통' } },
  },
  paladin: {
    key: 'paladin', name: '성기사', line: '탱커 한 명을 끝까지 지키는 힐러입니다.', star: 2,
    system: { name: '봉화', lv: 6, desc: '봉화를 지정한 파티원에게, 다른 사람에게 한 직접 힐의 40%가 함께 들어갑니다.' },
    dispel: ['마법', '독', '질병'],
    slots: slots({ basic: 'holyLight', fast: 'holyStrike', hot: 'oath', aoe: 'lightWave', dispel: 'handCleanse', ext: 'sacrifice', raid: 'sanctuary', unique: 'handGuard' }),
    tap: ['holyLight', 'holyStrike', 'oath'],
    passives: [
      { name: '굳건한 손', lv: 4, desc: '탱커에게 하는 직접 힐이 10% 늘어납니다.' },
      { name: '헌신', lv: 10, desc: '신성한 힘 3칸을 한 번에 쓰면 마나를 2% 회복합니다.' },
    ],
    // 25 원안은 「던전 2곳」. 지금 만든 던전이 녹슨 요새뿐이라 2번으로 (던전이 늘면 2곳으로 되돌림)
    unlock: { lv: 20, how: 'Lv 20 직업 퀘스트 「첫 맹세」', quest: { name: '첫 맹세', text: '성기사로 던전 2번 클리어', need: 2 } },
  },
};

export const HERO_KEYS = Object.keys(HEROES) as HeroKey[];

/** 그 직업의 칸 → 스킬 */
export const heroSlot = (hero: HeroKey, slot: SlotName): SkillKey | null => HEROES[hero].slots[slot];

/** 스킬 → 직업 (설명 화면에서 역참조) */
export const heroOfSkill = (key: SkillKey): HeroKey => HERO_KEYS.find(h => Object.values(HEROES[h].slots).includes(key)) || 'priest';

/** 해제 종류 색 (전투 판 디버프 색과 같음) */
export const DEB_COLOR: Record<string, string> = { '질병': '#D9A13B', '독': '#3CC24A', '마법': '#3D8BFF', '저주': '#A050E0' };

/** 그 직업이 그 디버프를 지울 수 있는지 */
export const canDispel = (hero: HeroKey, type: string) => HEROES[hero].dispel.includes(type);

/** 휠에 놓을 수 있는 칸 (고유 칸이 없는 직업은 7칸) */
export const heroSlotNames = (hero: HeroKey): SlotName[] =>
  (['basic', 'fast', 'hot', 'aoe', 'dispel', 'ext', 'raid', 'unique'] as SlotName[]).filter(s => HEROES[hero].slots[s]);

/** 칸 이름 (휠 배치 화면) */
export const SLOT_LABEL: Record<SlotName, string> = {
  basic: '기본 힐', fast: '빠른 힐', hot: '지속 힐', aoe: '광역 힐', dispel: '해제', ext: '외부 생존기', raid: '공대 쿨기', unique: '고유',
};

/** 그 직업에서 그 칸의 스킬 이름 (없으면 빈 칸) */
export function slotLabel(hero: HeroKey, slot: SlotName): string {
  const k = HEROES[hero].slots[slot];
  return k ? SKILLS[k].name : SLOT_LABEL[slot];
}

/** 휠 칸 이름 (저장·배치에 쓰는 이름 = 사제 스킬 이름, 8번째 칸 = unique). engine SLOT_OF의 반대 */
export const SLOT_ID: Record<SlotName, string> = { basic: 'heal', fast: 'flash', hot: 'renew', aoe: 'poh', dispel: 'purify', ext: 'guardian', raid: 'hymn', unique: 'unique' };
const SLOT_OF_ID = Object.fromEntries(Object.entries(SLOT_ID).map(([k, v]) => [v, k])) as Record<string, SlotName>;

/** 그 직업에서 휠 칸 이름 → 스킬 (사제는 칸 이름 그대로, 성언으로 바뀌지 않음) */
export function skillAt(hero: HeroKey, slotId: string): SkillKey | null {
  if (hero === 'priest') return slotId === 'unique' ? null : (slotId as SkillKey);
  const sl = SLOT_OF_ID[slotId];
  return sl ? HEROES[hero].slots[sl] : null;
}

/** 스킬 → 휠 칸 이름 (사제 성언은 바뀌는 조각 자리) */
export function slotIdOf(k: SkillKey): string {
  if (k === 'serenity') return 'heal';
  if (k === 'sanctify') return 'poh';
  return SLOT_ID[SKILLS[k].slot];
}

/** 직업의 스킬 목록 (휠 칸 순서, 사제는 성언 둘 포함) */
export function heroSkills(hero: HeroKey): SkillKey[] {
  const list = heroSlotNames(hero).map(s => HEROES[hero].slots[s]!);
  return hero === 'priest' ? [...list, 'serenity', 'sanctify'] : list;
}

/** 출시 뒤 시즌마다 1종씩 나오는 업데이트 직업 (25 1장, 해금은 골드 60,000 또는 크리스탈 1,500) */
export const UPDATE_HEROES = ['주술사', '수도사', '점성술사', '결계사'];
