/**
 * 힐러 직업 (25 문서). P2는 사제·드루이드·성기사 3종, 79 문서로 주술사 · 수도사 · 점성술사 · 결계사 4종을 더함 (직업 PR마다 ready로 켬).
 * 휠 8칸 구조와 배우는 레벨 순서는 모든 직업이 같고, 칸에 들어가는 스킬과 고유 시스템만 다르다 (25 2장).
 */
import type { DiffName } from './difficulty';
import { SKILLS, type SkillKey, type SlotName } from './skills';

export type HeroKey = 'priest' | 'druid' | 'paladin' | 'shaman' | 'monk' | 'astrologer' | 'warder';

export interface HeroPassive { name: string; lv: number; desc: string }

/** 직업 퀘스트 (25 5-4): 그 직업으로 조건을 채우면 해금. content가 없으면 아무 던전 */
export interface HeroQuest { name: string; text: string; need: number; content?: string; minDiff?: DiffName }

/** 예전 직업 바꾸기가 열리던 레벨 (25 4-1). v11부터 캐릭터 선택이라 로직엔 안 씀 (68), 옛 화면 문구용 */
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
  /**
   * v12 해금: 캐릭터 공통 레벨 달성. 직업 전환에는 캐릭터 칸이나 비용이 필요 없음.
   * quest = 예전 직업 퀘스트, 옛 저장 옮기기 (v6)에만 씀
   */
  unlock: { lv: number; how: string; quest?: HeroQuest };
  /** 가운데 버튼 스킬 (주술사 샘 토템 · 결계사 심판, 79 6-1). 휠 배치에는 안 들어감 */
  core?: SkillKey;
  /** 게임에 켠 직업 (79 6-1: 공통 준비에서는 데이터만 두고, 직업 PR마다 하나씩 켬). false면 직업 목록 · 저장 · 시뮬에서 빠지고 「곧 열림」으로 보임 */
  ready: boolean;
}

const slots = (o: Partial<Record<SlotName, SkillKey>>): Record<SlotName, SkillKey | null> => ({
  basic: null, fast: null, hot: null, aoe: null, dispel: null, ext: null, raid: null, unique: null, ...o,
});

export const HEROES: Record<HeroKey, HeroDef> = {
  priest: {
    key: 'priest', name: '사제', line: '꾸준히 넣으면 큰 한 방이 차오릅니다.', star: 1,
    system: { name: '성언 게이지', lv: 6, desc: '힐을 할 때마다 평온·신성화 게이지가 찹니다. 100%가 되면 휠 조각이 성언으로 바뀝니다.' },
    dispel: ['마법', '질병'],
    slots: slots({ basic: 'heal', fast: 'flash', hot: 'renew', aoe: 'poh', dispel: 'purify', ext: 'guardian', raid: 'hymn', unique: 'relay' }),
    tap: ['heal', 'flash', 'renew'],
    passives: [
      { name: '메아리 치유', lv: 1, desc: '치유·순간 치유·평온 힐량의 15%를 4초에 걸쳐 추가로 회복합니다.' },
      { name: '빛의 은총', lv: 4, desc: '소생이 걸린 대상에게 하는 직접 힐이 10% 늘어납니다.' },
      { name: '상징', lv: 10, desc: '전투마다 한 번, 마나가 30% 아래로 내려가면 5초 동안 마나 회복이 4배가 됩니다.' },
    ],
    unlock: { lv: 1, how: '처음부터' },
    ready: true,
  },
  druid: {
    key: 'druid', name: '드루이드', line: '위기 전에 미리 깔아 두는 힐러입니다.', star: 2,
    system: { name: '군락', lv: 6, desc: '새싹이 걸린 칸끼리 붙어 있으면 붙은 칸 하나마다 새싹 회복이 10%씩, 최대 30%까지 늘어납니다. 20인 레이드에서는 30%씩 최대 90%까지 늘고, 들꽃 군락에도 붙습니다.' },
    dispel: ['마법', '저주', '독'],
    slots: slots({ basic: 'sprout', fast: 'growth', hot: 'bloom', aoe: 'wildflower', dispel: 'natureCleanse', ext: 'bark', raid: 'quietwood', unique: 'rebirth' }),
    tap: ['sprout', 'growth', 'bloom'],
    passives: [
      { name: '뿌리 깊음', lv: 4, desc: '지속 힐이 2개 이상 걸린 대상에게 하는 직접 힐이 10% 늘어납니다.' },
      { name: '순환', lv: 10, desc: '새싹이 끝까지 다 차면 마나를 0.4% 돌려받습니다.' },
    ],
    unlock: { lv: 10, how: '캐릭터 Lv 10 달성', quest: { name: '숲의 부름', text: '드루이드로 녹슨 요새 보통 이상 클리어', need: 1, content: 'rustfort', minDiff: '보통' } },
    ready: true,
  },
  paladin: {
    key: 'paladin', name: '성기사', line: '탱커 한 명을 끝까지 지키는 힐러입니다.', star: 2,
    system: { name: '봉화', lv: 6, desc: '봉화를 지정한 파티원에게, 다른 사람에게 한 빛의 손길 · 빛 일격 회복량의 40%가 함께 들어갑니다. 10인 레이드는 30%, 20인 레이드는 25%입니다.' },
    dispel: ['마법', '독', '질병'],
    slots: slots({ basic: 'holyLight', fast: 'holyStrike', hot: 'oath', aoe: 'lightWave', dispel: 'handCleanse', ext: 'sacrifice', raid: 'sanctuary', unique: 'handGuard' }),
    tap: ['holyLight', 'holyStrike', 'oath'],
    passives: [
      { name: '굳건한 손', lv: 4, desc: '탱커에게 하는 직접 힐이 10% 늘어납니다.' },
      { name: '헌신', lv: 10, desc: '신성한 힘 3칸을 한 번에 쓰면 마나를 2% 회복합니다.' },
    ],
    // 25 원안은 「던전 2곳」. 지금 만든 던전이 녹슨 요새뿐이라 2번으로 (던전이 늘면 2곳으로 되돌림)
    unlock: { lv: 20, how: '캐릭터 Lv 20 달성', quest: { name: '첫 맹세', text: '성기사로 녹슨 요새 어려움 이상 클리어', need: 1, content: 'rustfort', minDiff: '어려움' } },
    ready: true,
  },
  // ---------- 79 힐러 직업 4종 (열림 Lv 30 · 40 · 50 · 60, 무료 레벨 해금) ----------
  shaman: {
    key: 'shaman', name: '주술사', line: '다친 사람을 따라 물이 흘러가는 힐러입니다.', star: 2,
    system: { name: '토템 칸', lv: 6, desc: '가운데 버튼을 누르고 칸을 고르면 그 칸에 샘 토템을 세웁니다. 15초 동안 3초마다 그 칸과 붙어 있는 6칸의 아군을 회복합니다 (20인 레이드에서는 70%). 토템은 종류마다 하나만 서고, 그 칸에 장판이 깔리거나 예고된 공격이 떨어지거나 적이 나오면 깨집니다.' },
    dispel: ['마법', '저주'],
    slots: slots({ basic: 'ripple', fast: 'shower', hot: 'droplet', aoe: 'chainHeal', dispel: 'washing', ext: 'earthTotem', raid: 'rainTotem', unique: 'spiritLink' }),
    tap: ['ripple', 'shower', 'droplet'],
    passives: [
      { name: '깊은 물', lv: 4, desc: '체력 50% 아래인 대상에게 하는 직접 힐이 30% 늘어납니다.' },
      { name: '밀려오는 물', lv: 10, desc: '연쇄 치유가 4명에게 닿으면 마나를 1.5% 돌려받습니다.' },
    ],
    unlock: { lv: 30, how: '캐릭터 Lv 30 달성' },
    core: 'springTotem',
    ready: true,
  },
  monk: {
    key: 'monk', name: '수도사', line: '손을 쉬지 않을수록 힘이 붙는 힐러입니다.', star: 3,
    system: { name: '기 리듬', lv: 6, desc: '생기 손바닥을 2.5초 안에 이어 치면 기 리듬이 올라 (최대 5) 손바닥 회복량이 리듬마다 6% 늘어납니다. 리듬 3부터는 떠도는 안개가 두 배로 빨리 돌아옵니다. 늦으면 리듬이 0으로 내려갑니다.' },
    dispel: ['마법', '질병'],
    slots: slots({ basic: 'vitalPalm', fast: 'mistWrap', hot: 'wanderMist', aoe: 'mistBreath', dispel: 'clearChi', ext: 'soothe', raid: 'reviveWind', unique: 'tea' }),
    tap: ['vitalPalm', 'mistWrap', 'wanderMist'],
    passives: [
      { name: '스며드는 안개', lv: 4, desc: '안개가 걸린 아군에게 하는 생기 손바닥이 15% 늘어납니다.' },
      { name: '고요한 호흡', lv: 10, desc: '전투마다 한 번, 마나가 30% 아래로 내려가면 10초 동안 마나 소모가 50% 줄어듭니다.' },
    ],
    unlock: { lv: 40, how: '캐릭터 Lv 40 달성' },
    ready: true,
  },
  astrologer: {
    key: 'astrologer', name: '점성술사', line: '별을 이어 모았다가 한 번에 터뜨리는 힐러입니다.', star: 3,
    system: { name: '별자리 잇기', lv: 6, desc: '별비와 북극성은 누르고 있는 동안 별이 0.5초마다 하나씩 4개까지 이어지고, 떼면 별 수만큼 크게 터집니다. 4번째 별 뒤 0.5초 안에 떼면 완벽한 별자리로 15% 더 회복합니다. 별빛 치유와 반짝임이 주는 별 조각으로 다음 별자리를 미리 이어 둡니다.' },
    dispel: ['마법', '독'],
    slots: slots({ basic: 'starHeal', fast: 'twinkle', hot: 'starMark', aoe: 'starfall', dispel: 'clearStar', ext: 'starSleep', raid: 'starMemory', unique: 'polaris' }),
    tap: ['starHeal', 'twinkle', 'starMark'],
    passives: [
      { name: '별 읽기', lv: 4, desc: '보스 예고가 찍힌 아군에게 하는 힐이 15% 늘어납니다.' },
      { name: '별의 순환', lv: 10, desc: '완벽한 별자리를 만들 때마다 마나를 3% 돌려받습니다.' },
    ],
    unlock: { lv: 50, how: '캐릭터 Lv 50 달성' },
    ready: true,
  },
  warder: {
    key: 'warder', name: '결계사', line: '막을 미리 씌우고, 공격으로 치유를 터뜨리는 힐러입니다.', star: 3,
    system: { name: '심판', lv: 6, desc: '결계사의 힐과 보호막은 대상에게 15초 동안 인장을 붙입니다. 가운데 버튼으로 심판을 외치면 보스를 치고, 인장이 붙은 아군 중 체력이 가장 낮은 6명 (5인 던전 3명, 10인 레이드 4명)을 한꺼번에 회복합니다.' },
    dispel: ['마법', '저주'],
    slots: slots({ basic: 'sealHeal', fast: 'quickSeal', hot: 'lightBarrier', aoe: 'wardCircle', dispel: 'wardCleanse', ext: 'guardWard', raid: 'lightVeil', unique: 'lightSpear' }),
    tap: ['sealHeal', 'quickSeal', 'lightBarrier'],
    passives: [
      { name: '깨진 막의 빛', lv: 4, desc: '내 보호막이 다 깨지면 그 아군 체력을 {80} 회복합니다.' },
      { name: '인장의 대가', lv: 10, desc: '심판이 4명 이상 회복하면 마나를 2% 돌려받습니다.' },
    ],
    unlock: { lv: 60, how: '캐릭터 Lv 60 달성' },
    core: 'judgment',
    ready: true,
  },
};

/** 직업 7종 (데이터에 있는 것 모두, 「곧 열림」 포함) */
export const ALL_HERO_KEYS = Object.keys(HEROES) as HeroKey[];
/** 게임에 켠 직업 (직업 목록 · 저장 · 시뮬 · 직업마다 도는 테스트). 79 직업은 직업 PR마다 ready로 켬 */
export const HERO_KEYS = ALL_HERO_KEYS.filter(h => HEROES[h].ready);
/** 가운데 버튼 스킬이 있는 직업 → 그 스킬 (79 6-1) */
export const CORE_SKILL: Partial<Record<HeroKey, SkillKey>> = Object.fromEntries(ALL_HERO_KEYS.filter(h => HEROES[h].core).map(h => [h, HEROES[h].core!]));

/** 그 직업의 칸 → 스킬 */
export const heroSlot = (hero: HeroKey, slot: SlotName): SkillKey | null => HEROES[hero].slots[slot];

/** 스킬 → 직업 (설명 화면에서 역참조) */
export const heroOfSkill = (key: SkillKey): HeroKey => ALL_HERO_KEYS.find(h => Object.values(HEROES[h].slots).includes(key) || HEROES[h].core === key) || 'priest';

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

/** 휠 밖 가운데 버튼 자리 이름 (79 6-1, 가운데 스킬은 휠 배치에 안 들어감) */
export const CORE_ID = 'core';

/** 그 직업에서 휠 칸 이름 → 스킬 (사제는 칸 이름 그대로, 성언으로 바뀌지 않음. 8번째 칸은 직업마다). core = 가운데 버튼 스킬 */
export function skillAt(hero: HeroKey, slotId: string): SkillKey | null {
  if (slotId === CORE_ID) return HEROES[hero].core ?? null;
  if (hero === 'priest' && slotId !== 'unique') return slotId as SkillKey;
  const sl = SLOT_OF_ID[slotId];
  return sl ? HEROES[hero].slots[sl] : null;
}

/** 스킬 → 휠 칸 이름 (사제 성언은 바뀌는 조각 자리) */
export function slotIdOf(k: SkillKey): string {
  if (SKILLS[k].core) return CORE_ID;
  if (k === 'serenity') return 'heal';
  if (k === 'sanctify') return 'poh';
  return SLOT_ID[SKILLS[k].slot];
}

/** 직업의 스킬 목록 (휠 칸 순서, 사제는 성언 둘, 가운데 스킬이 있는 직업은 그 스킬을 끝에) */
export function heroSkills(hero: HeroKey): SkillKey[] {
  const list = heroSlotNames(hero).map(s => HEROES[hero].slots[s]!);
  const core = HEROES[hero].core;
  return hero === 'priest' ? [...list, 'serenity', 'sanctify'] : core ? [...list, core] : list;
}

/**
 * 아직 켜지 않은 업데이트 직업 이름 (직업 고르기의 「곧 열림」 칸). 79 직업 PR마다 하나씩 빠짐.
 * 예전 25 1장은 시즌마다 1종 · 골드 60,000 또는 크리스탈 1,500. 79는 레벨 해금 (주술사 30 · 수도사 40 · 점성술사 50 · 결계사 60, 무료)
 */
export const UPDATE_HEROES = ALL_HERO_KEYS.filter(h => !HEROES[h].ready).map(h => HEROES[h].name);
