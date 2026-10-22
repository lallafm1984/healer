/**
 * 힐러 직업 (25 문서). P2는 사제·드루이드·성기사 3종, 79 문서로 주술사 · 수도사 · 점성술사 · 결계사 4종을 더함 (직업 PR마다 ready로 켬).
 * 휠 8칸 구조와 배우는 레벨 순서는 모든 직업이 같고, 칸에 들어가는 스킬과 고유 시스템만 다르다 (25 2장).
 */
import type { DiffName } from './difficulty';
import { SKILLS, type SkillKey, type SlotName } from './skills';
import { judgeText, SHAMAN, WARDER } from './heroConst';

export type HeroKey = 'priest' | 'druid' | 'paladin' | 'shaman' | 'monk' | 'astrologer' | 'warder';

export interface HeroPassive { name: string; lv: number; desc: string }

/** 직업 퀘스트 (25 5-4): 그 직업으로 조건을 채우면 해금. content가 없으면 아무 던전 */
export interface HeroQuest { name: string; text: string; need: number; content?: string; minDiff?: DiffName }

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
   * 81 (2026-10-15 Lim): 드루이드 Lv 20 · 성기사 Lv 30 무료, 79 직업 4종은 상점에서 하나에 2,200원 (buy = 앱 결제 상품, 사면 레벨 조건 없음, lv는 쓰지 않음).
   * quest = 예전 직업 퀘스트, 옛 저장 옮기기 (v6)에만 씀
   */
  unlock: { lv: number; how: string; quest?: HeroQuest; buy?: boolean };
  /** 게임에 켠 직업 (79 6-1: 공통 준비에서는 데이터만 두고, 직업 PR마다 하나씩 켬). false면 직업 목록 · 저장 · 시뮬에서 빠지고 「곧 열림」으로 보임 */
  ready: boolean;
}

const slots = (o: Partial<Record<SlotName, SkillKey>>): Record<SlotName, SkillKey | null> => ({
  basic: null, fast: null, hot: null, aoe: null, dispel: null, ext: null, raid: null, unique: null, ...o,
});

export const HEROES: Record<HeroKey, HeroDef> = {
  priest: {
    key: 'priest', name: '사제', line: '꾸준히 넣으면 큰 한 방이 차오릅니다.', star: 1,
    system: { name: '평온 게이지', lv: 6, desc: '치유 · 순간 치유 · 소생 · 치유의 기원 · 빛의 전이로 평온 게이지가 찹니다. 100%가 되면 치유 칸이 성언: 평온으로 바뀌어 한 명을 마나 없이 크게 회복합니다.' },
    dispel: ['마법', '질병'],
    slots: slots({ basic: 'heal', fast: 'flash', hot: 'renew', aoe: 'poh', dispel: 'purify', ext: 'guardian', raid: 'hymn', unique: 'relay' }),
    tap: ['heal', 'flash', 'renew'],
    passives: [
      { name: '메아리 치유', lv: 1, desc: '치유·순간 치유·평온 힐량의 15%를 4초에 걸쳐 추가로 회복합니다.' },
      { name: '빛의 은총', lv: 4, desc: '소생이 걸린 대상에게 하는 치유 · 순간 치유가 10% 늘어납니다.' },
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
    unlock: { lv: 20, how: '캐릭터 Lv 20 달성', quest: { name: '숲의 부름', text: '드루이드로 녹슨 요새 보통 이상 클리어', need: 1, content: 'rustfort', minDiff: '보통' } },
    ready: true,
  },
  paladin: {
    key: 'paladin', name: '성기사', line: '탱커 한 명을 끝까지 지키는 힐러입니다.', star: 2,
    system: { name: '봉화', lv: 6, desc: '봉화 스킬로 지정한 파티원에게, 다른 사람에게 한 빛의 손길 회복량의 40%가 함께 들어갑니다. 10인 레이드는 30%, 20인 레이드는 25%입니다.' },
    dispel: ['마법', '독', '질병'],
    slots: slots({ basic: 'holyLight', fast: 'beacon', hot: 'oath', aoe: 'lightWave', dispel: 'handCleanse', ext: 'sacrifice', raid: 'sanctuary', unique: 'handGuard' }),
    tap: ['holyLight', 'oath'],
    passives: [
      { name: '굳건한 손', lv: 4, desc: '탱커에게 하는 직접 힐이 10% 늘어납니다.' },
      { name: '헌신', lv: 10, desc: '신성한 힘 3칸을 한 번에 쓰면 마나를 2% 회복합니다.' },
    ],
    // 25 원안은 「던전 2곳」. 지금 만든 던전이 녹슨 요새뿐이라 2번으로 (던전이 늘면 2곳으로 되돌림)
    unlock: { lv: 30, how: '캐릭터 Lv 30 달성', quest: { name: '첫 맹세', text: '성기사로 녹슨 요새 어려움 이상 클리어', need: 1, content: 'rustfort', minDiff: '어려움' } },
    ready: true,
  },
  // ---------- 79 힐러 직업 4종: 상점에서 하나에 2,200원 (81, 예전 Lv 30 · 40 · 50 · 60 무료) ----------
  shaman: {
    key: 'shaman', name: '주술사', line: '다친 사람을 따라 물이 흘러가는 힐러입니다.', star: 2,
    system: { name: '토템 칸', lv: 6, desc: `샘 토템을 아군 칸에 쓰면 그 칸에 토템을 세웁니다. 15초 동안 3초마다 그 칸과 붙어 있는 6칸의 아군을 회복합니다${SHAMAN.spring.big < 1 ? ` (20인 레이드에서는 ${Math.round(SHAMAN.spring.big * 100)}%)` : ''}. 토템은 종류마다 하나만 서고, 그 칸에 장판이 깔리거나 예고된 공격이 떨어지거나 적이 나오면 깨집니다.` },
    dispel: ['마법', '저주'],
    slots: slots({ basic: 'ripple', fast: 'springTotem', hot: 'droplet', aoe: 'chainHeal', dispel: 'washing', ext: 'earthTotem', raid: 'rainTotem', unique: 'spiritLink' }),
    tap: ['ripple', 'droplet'],
    passives: [
      { name: '깊은 물', lv: SHAMAN.deep.lv, desc: `체력 ${SHAMAN.deep.hp * 100}% 아래인 대상에게 하는 직접 힐이 ${Math.round(SHAMAN.deep.heal * 100)}% 늘어납니다.` },
      { name: '밀려오는 물', lv: 10, desc: '연쇄 치유가 4명에게 닿으면 마나를 1.5% 돌려받습니다.' },
    ],
    unlock: { lv: 0, how: '상점 구매', buy: true },
    ready: true,
  },
  monk: {
    key: 'monk', name: '수도사', line: '손을 쉬지 않을수록 힘이 붙는 힐러입니다.', star: 3,
    system: { name: '기 리듬', lv: 1, desc: '생기 손바닥을 2.5초 안에 이어 치면 기 리듬이 올라 (최대 5) 손바닥 회복량이 리듬마다 6% 늘어납니다. 리듬 3부터는 떠도는 안개가 두 배로 빨리 돌아옵니다. 늦으면 리듬이 0으로 내려갑니다.' },
    dispel: ['마법', '질병'],
    slots: slots({ basic: 'vitalPalm', fast: 'mistWrap', hot: 'wanderMist', aoe: 'mistBreath', dispel: 'clearChi', ext: 'soothe', raid: 'reviveWind', unique: 'tea' }),
    tap: ['vitalPalm', 'mistWrap', 'wanderMist'],
    passives: [
      { name: '스며드는 안개', lv: 4, desc: '안개가 걸린 아군에게 하는 생기 손바닥이 15% 늘어납니다.' },
      { name: '고요한 호흡', lv: 10, desc: '전투마다 한 번, 마나가 30% 아래로 내려가면 10초 동안 마나 소모가 50% 줄어듭니다.' },
    ],
    unlock: { lv: 0, how: '상점 구매', buy: true },
    ready: true,
  },
  astrologer: {
    key: 'astrologer', name: '점성술사', line: '별 조각을 모아 별자리로 터뜨리는 힐러입니다.', star: 2,
    // 83 (Lim 「스와이프로 조작시 매우 불편」): 누르고 떼는 모으기 → 별 조각 시전
    system: { name: '별 조각', lv: 6, desc: '별빛 치유와 반짝임이 별 조각을 1개씩 줍니다 (최대 3개). 별비 · 북극성 · 별의 기억은 시전이 끝날 때 모은 조각을 모두 써서 별 1 + 조각개로 터집니다. 조각 3개를 다 쓰면 가득 찬 별자리로 15% 더 회복합니다.' },
    dispel: ['마법', '독'],
    slots: slots({ basic: 'starHeal', fast: 'twinkle', hot: 'starMark', aoe: 'starfall', dispel: 'clearStar', ext: 'starSleep', raid: 'starMemory', unique: 'polaris' }),
    tap: ['starHeal', 'twinkle', 'starMark'],
    passives: [
      { name: '별 읽기', lv: 4, desc: '보스 예고가 찍힌 아군에게 하는 힐이 15% 늘어납니다.' },
      { name: '별의 순환', lv: 10, desc: '가득 찬 별자리를 터뜨릴 때마다 마나를 3% 돌려받습니다.' },
    ],
    unlock: { lv: 0, how: '상점 구매', buy: true },
    ready: true,
  },
  warder: {
    key: 'warder', name: '결계사', line: '막을 미리 씌우고, 인장으로 치유를 터뜨리는 힐러입니다.', star: 3,
    system: { name: '심판', lv: 6, desc: `결계사의 힐과 보호막은 대상에게 15초 동안 인장을 붙입니다. 심판을 외치면 인장이 붙은 아군 중 체력이 가장 낮은 ${judgeText()}을 한꺼번에 회복합니다.` },
    dispel: ['마법', '저주'],
    slots: slots({ basic: 'sealHeal', fast: 'judgment', hot: 'lightBarrier', aoe: 'wardCircle', dispel: 'wardCleanse', ext: 'guardWard', raid: 'lightVeil', unique: 'wardHold' }),
    tap: ['sealHeal', 'lightBarrier'],
    passives: [
      { name: '깨진 막의 빛', lv: 4, desc: '내 보호막이 다 깨지면 그 아군 체력을 {120} 회복합니다.' },
      { name: '인장의 대가', lv: 10, desc: `심판이 ${WARDER.price.n}명 이상 회복하면 마나를 ${WARDER.price.mana}% 돌려받습니다.` },
    ],
    unlock: { lv: 0, how: '상점 구매', buy: true },
    ready: true,
  },
};

/** 직업 7종 (데이터에 있는 것 모두, 「곧 열림」 포함) */
export const ALL_HERO_KEYS = Object.keys(HEROES) as HeroKey[];
/** 게임에 켠 직업 (직업 목록 · 저장 · 시뮬 · 직업마다 도는 테스트). 79 직업은 직업 PR마다 ready로 켬 */
export const HERO_KEYS = ALL_HERO_KEYS.filter(h => HEROES[h].ready);
/** 스킬 → 직업 (설명 화면에서 역참조) */
export const heroOfSkill = (key: SkillKey): HeroKey => ALL_HERO_KEYS.find(h => Object.values(HEROES[h].slots).includes(key)) || 'priest';

/** 해제 종류 색 (전투 판 디버프 색과 같음) */
export const DEB_COLOR: Record<string, string> = { '질병': '#D9A13B', '독': '#3CC24A', '마법': '#3D8BFF', '저주': '#A050E0' };

/** 그 직업이 그 디버프를 지울 수 있는지 */
export const canDispel = (hero: HeroKey, type: string) => HEROES[hero].dispel.includes(type);

/** 휠에 놓을 수 있는 칸 (고유 칸이 없는 직업은 7칸) */
export const heroSlotNames = (hero: HeroKey): SlotName[] =>
  (['basic', 'fast', 'hot', 'aoe', 'dispel', 'ext', 'raid', 'unique'] as SlotName[]).filter(s => HEROES[hero].slots[s]);

/** 휠 칸 이름 (저장·배치에 쓰는 이름 = 사제 스킬 이름, 8번째 칸 = unique). engine SLOT_OF의 반대 */
export const SLOT_ID: Record<SlotName, string> = { basic: 'heal', fast: 'flash', hot: 'renew', aoe: 'poh', dispel: 'purify', ext: 'guardian', raid: 'hymn', unique: 'unique' };
const SLOT_OF_ID = Object.fromEntries(Object.entries(SLOT_ID).map(([k, v]) => [v, k])) as Record<string, SlotName>;

/** 그 직업에서 휠 칸 이름 → 스킬 (사제는 칸 이름 그대로, 성언으로 바뀌지 않음. 8번째 칸은 직업마다) */
export function skillAt(hero: HeroKey, slotId: string): SkillKey | null {
  if (hero === 'priest' && slotId !== 'unique') return slotId as SkillKey;
  const sl = SLOT_OF_ID[slotId];
  return sl ? HEROES[hero].slots[sl] : null;
}

/** 스킬 → 휠 칸 이름 (사제 성언: 평온은 치유 칸) */
export function slotIdOf(k: SkillKey): string {
  if (k === 'serenity') return 'heal';
  return SLOT_ID[SKILLS[k].slot];
}

/** 직업의 스킬 목록 (휠 칸 순서, 사제는 성언: 평온을 끝에) */
export function heroSkills(hero: HeroKey): SkillKey[] {
  const list = heroSlotNames(hero).map(s => HEROES[hero].slots[s]!);
  return hero === 'priest' ? [...list, 'serenity'] : list;
}

/**
 * 아직 켜지 않은 업데이트 직업 이름 (직업 고르기의 「곧 열림」 칸). 79 직업 PR마다 하나씩 빠짐.
 * 예전 25 1장은 시즌마다 1종 · 골드 60,000 또는 크리스탈 1,500. 79는 레벨 해금 (주술사 30 · 수도사 40 · 점성술사 50 · 결계사 60, 무료)
 */
export const UPDATE_HEROES = ALL_HERO_KEYS.filter(h => !HEROES[h].ready).map(h => HEROES[h].name);
