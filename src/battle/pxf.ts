/**
 * 전투 이펙트 프레임 띠 (이름은 예전 PXF 공방 이펙트에서 옴). 모두 판 맨 위 층 (board.ts pxfL, Lim 「파티원에서 최상단으로」), 보통 섞기.
 * - 손그림풍 (2026-10-16 Lim 「스킬이펙트가 너무 허술」 → 「다른 기타 이펙트도 손그림으로 (도트를 모두 제거)」): scripts/vfx/<묶음>.mjs를 캔버스로 그려
 *   src/art/fx-skill-<이름>.webp (224px · 공통 효과는 192px 격자)로 구움 (npm run fx:bake, scripts/vfx/README.md). 직업 스킬 · 전투 공통 효과 · 파티원 능력
 * - 보스 판 전체 공격: Codex 손그림 띠 src/art/fx-wide-<이름>.webp (66 문서, 256px 격자)
 * - 예전 PXF 도트 (64px 그래프 · 띠)는 모두 지움. 모양 표는 src/art/pxf/requests.md
 * 값은 tests/pxf.test.ts가 그리기 코드 · 그림 크기와 맞춰 봄. 2026-10-11 Lim: 사제 치유로 시험 → 「직업별 모든 스킬에」 → 전투 공통 효과 · 파티원 능력 · 보스 판 전체 공격도
 */
import type { AbKind } from '../data/abilities';
import { BOSSES } from '../data/bosses';
import type { Encounter } from '../data/encounters';
import { heroSkills, type HeroKey } from '../data/heroes';
import type { SkillKey } from '../data/skills';
import { areaRadius, hexDist, living } from '../engine';
import type { Fight, Unit } from '../engine/types';
import { BOSS_FX } from './art';

export interface PxfClip {
  /** 띠에 구운 프레임 한 장 크기 (px) · 장 수 · 초당 장 수 */
  size: number;
  frames: number;
  fps: number;
  /** 띠 한 줄의 프레임 수 (보통 frames = 가로 한 줄, 보스 판 전체 공격은 격자: 256px × 22장을 한 줄로 이으면 폰 텍스처 한도를 넘음) */
  cols: number;
  /** 섞기 (game.blend, 게임에서 바꿀 수 있음): add = 더하기 (밝은 칸에선 흰빛으로 보임), normal = 원본 색 그대로 */
  blend: 'add' | 'normal';
  /** 맞는 순간 프레임 (game.impactFrame): 스킬이 들어간 순간이 이 프레임 */
  impactFrame: number;
  /** 기준 칸 크기 (game.referenceCell, 없으면 62)일 때 그림 크기 (game.logicalSize) */
  logicalSize: number;
  referenceCell: number;
  /** 회색 그림: 게임이 종류마다 색을 곱해 칠함 (치유 = 문장 색 · 쓰러짐 = 역할 색 · 디버프 = 종류 색 · 장비 발동 = 묶음 색) */
  gray: boolean;
}

/** 손그림풍 스킬 이펙트 프레임 크기 (scripts/vfx/index.mjs FX_SIZE) */
export const SKILL_FX_SIZE = 224;
/**
 * 손그림풍 스킬 이펙트 (scripts/vfx/<직업>.mjs와 장 수 · 그림 지름이 같아야 함, tests/pxf.test.ts): 첫 프레임이 들어간 순간.
 * logical = 기준 칸 62일 때 그림 지름 (칸보다 크게 그려 칸 밖까지 빛이 번짐, 범위 · 파티 스킬은 칸만 하게)
 */
const skill = (frames: number, logical: number, o: { size?: number; gray?: boolean } = {}): PxfClip =>
  ({ size: o.size ?? SKILL_FX_SIZE, frames, fps: 24, cols: Math.ceil(Math.sqrt(frames)), blend: 'normal', impactFrame: 0, logicalSize: logical, referenceCell: 62, gray: !!o.gray });
/** 전투 공통 효과 · 파티원 능력: 작고 자주 뜨므로 192px (scripts/vfx/common.mjs) */
const small = (frames: number, logical: number, gray = false): PxfClip => skill(frames, logical, { size: 192, gray });
/**
 * 판 위 선 물건이 서 있는 동안 계속 도는 손그림풍 루프 (scripts/vfx loop: true): 마지막 장 다음이 첫 장, fps 초당 장 수.
 * board.ts가 선 물건 그림 위 (이름 · 체력 아래)에 그 물건 크기에 맞춰 그림 (2026-10-18 Lim 「판 위 토템 … 이펙트가 루프로 돌게」)
 */
const loop = (frames: number, logical: number, fps: number, size?: number): PxfClip => ({ ...skill(frames, logical, { size }), fps });
/** 주술사 샘 · 대지 토템 그림 (board-totem-*, 자원 그림의 토템을 잘라 낸 네모) 한 변 = 칸 반지름 × 이 값. 루프 그리기 코드 (scripts/vfx/shaman.mjs TOTEM)도 같은 값 */
export const TOTEM_STAND = 1.1;
/** 봉화 루프 그림 안 고리 반지름 (프레임 반 = 1). 루프 그리기 코드 (scripts/vfx/paladin.mjs RING)도 같은 값 */
export const BEACON_RING = 0.72;
/** 보스 판 전체 공격의 설계 캔버스 (판 너비 기준, game.logicalSize) */
export const WIDE_DESIGN = 128;
/**
 * 보스 판 전체 공격: Codex 손그림 띠 (66 `fx-wide-<이름>.webp`, 256px 프레임을 거의 정사각형 격자로: 22장 = 5×5, 1280px).
 * 처음엔 PXF 도트 띠 (128px 설계 → 우리 렌더러 256px)였고 2026-10-16 Lim 「도트를 모두 제거」로 손그림 띠만 남김
 */
const wide = (frames: number, impactFrame: number, gray = false): PxfClip =>
  ({ size: 256, frames, fps: 24, cols: Math.ceil(Math.sqrt(frames)), blend: 'normal', impactFrame, logicalSize: WIDE_DESIGN, referenceCell: 62, gray });

/** 이름 = 그리기 코드 (scripts/vfx) · 프레임 띠 파일 이름 (fx-skill-<이름>.webp, 보스는 fx-wide-*) */
export const PXF = {
  // 직업 스킬: 손그림풍 (scripts/vfx, Lim 2026-10-16 「퀄리티 있게 모두 다시」). 모양은 requests.md 모양 표 그대로
  'priest-heal': skill(22, 80),
  'priest-flash': skill(14, 92),
  'priest-renew': skill(24, 84),
  'priest-poh': skill(20, 74),
  'priest-purify': skill(18, 86),
  'priest-guardian': skill(24, 98),
  'priest-hymn': skill(20, 70),
  'priest-serenity': skill(24, 100),
  'priest-relay': skill(20, 92),
  'druid-sprout': skill(20, 80),
  'druid-growth': skill(20, 88),
  'druid-bloom': skill(18, 90),
  'druid-wildflower': skill(24, 72),
  'druid-cleanse': skill(18, 90),
  'druid-bark': skill(24, 92),
  'druid-quietwood': skill(24, 72),
  'druid-rebirth': skill(24, 98),
  'paladin-holy-light': skill(16, 80), // 기본 힐이라 가볍게 (Lim 2026-10-16 「너무 과하다」)
  'paladin-beacon': skill(20, 100, { size: 384 }), // 봉화 그릇 · 불꽃 그림이 뭉개지지 않게 384px 프레임 (10-19 Lim)
  'paladin-oath': skill(24, 90),
  'paladin-light-wave': skill(20, 88),
  'paladin-cleanse': skill(22, 100, { size: 384 }), // 태양 문장 그림이 뭉개지지 않게 384px 프레임 (10-19 Lim 「손 모양 제거하고 다른 느낌으로」)
  'paladin-sacrifice': skill(22, 96, { size: 320 }), // 방패를 크게 (10-19 Lim)
  'paladin-sanctuary': skill(24, 76),
  'paladin-hand-guard': skill(24, 94),
  // 봉화 대상 칸 둘레에서 도는 루프 (스킬 기록이 아니라 board.ts, 2026-10-18 Lim 「봉화대상의 동그란 이미지도 파티클로 루프」)
  'paladin-beacon-loop': loop(36, 62, 12, 320),
  'shaman-ripple': skill(24, 88),
  'shaman-droplet': skill(22, 88),
  'shaman-washing': skill(22, 96),
  'shaman-chain': skill(16, 100),
  'shaman-earth': skill(22, 94),
  'shaman-rain': skill(22, 76),
  'shaman-link': skill(22, 84),
  // 수도사 (2026-10-19 Lim 「퀄리티 및 파티클 보강, 전면 개편」): Codex 그림이 또렷하게 프레임 256 ~ 320px
  'monk-palm': skill(14, 86, { size: 256 }),
  'monk-wrap': skill(22, 92, { size: 320 }),
  'monk-mist': skill(24, 90, { size: 320 }),
  'monk-breath': skill(20, 80, { size: 288 }),
  'monk-clear': skill(18, 90, { size: 320 }),
  'monk-soothe': skill(24, 92, { size: 320 }),
  'monk-wind': skill(20, 80, { size: 288 }),
  'monk-tea': skill(24, 88, { size: 320 }),
  // 점성술사 (2026-10-19 Lim 「퀄리티 및 파티클 보강, 전면 개편」): Codex 그림이 또렷하게 프레임 256 ~ 384px
  'astro-star': skill(20, 88, { size: 288 }),
  'astro-twinkle': skill(16, 86, { size: 256 }),
  'astro-mark': skill(20, 88, { size: 288 }),
  'astro-clear': skill(20, 92, { size: 320 }),
  'astro-fall': skill(20, 90, { size: 320 }),
  'astro-sleep': skill(24, 92, { size: 320 }),
  'astro-memory': skill(22, 84, { size: 288 }),
  'astro-polaris': skill(22, 100, { size: 384 }),
  'shaman-spring': skill(24, 92),
  // 판 위 토템이 서 있는 동안 도는 루프 (스킬 기록이 아니라 board.ts 선 물건): 3초 한 바퀴
  'shaman-spring-loop': loop(36, 64, 12),
  'shaman-earth-loop': loop(36, 64, 12),
  // 판 오른쪽 위 비구름 토템 (구름만) 위에서 도는 루프: 비는 이 이펙트로 (그림 한 변 × 75/62, 가운데가 그림보다 한 변의 반 아래)
  'shaman-rain-loop': loop(36, 75, 12),
  // 결계사 (79 5-5 네모 결계, 2026-10-16 Lim 「흰색이라서 퀄리티가 더 떨어져보인다. 노란 발광의 빛이나게」→ 손그림풍 노란 빛): 인장 X · 도장 · 유리판 · 깨지는 유리 · 네 말뚝 · 도는 방패 · 가로 띠 · 창 · 망치
  'warder-seal': skill(20, 92, { size: 320 }), // 2026-10-19 Lim 「결계사도 퀄리티 및 파티클 보강, 전면 개편」: Codex 그림이 또렷하게 288 ~ 320px
  'warder-barrier': skill(22, 96, { size: 320 }),
  'warder-cleanse': skill(18, 94, { size: 320 }),
  'warder-circle': skill(20, 82, { size: 288 }),
  'warder-guard': skill(22, 96, { size: 320 }),
  'warder-veil': skill(24, 82, { size: 288 }),
  'warder-hold': skill(20, 92, { size: 320 }),
  'warder-judgment': skill(18, 88, { size: 288 }),
  // 모든 효과 PXF 1단계 (requests.md): 전투 공통 효과 (회색 그림은 색을 곱함)
  'common-hit': small(11, 74),
  'common-crit': small(12, 66),
  'common-heal': small(14, 64, true),
  'common-dispel': small(14, 76),
  'common-revive': small(20, 84),
  'common-death': small(18, 80, true),
  'common-debuff': small(16, 76, true),
  'common-proc': small(12, 70, true),
  // 모든 효과 PXF 1단계 (requests.md): 파티원 능력 종류마다
  'ally-def': small(16, 80),
  'ally-ctl': small(16, 80),
  'ally-sup': small(16, 78),
  'ally-heal': small(16, 76),
  'ally-atk': small(14, 82),
  // 보스 판 전체 공격 (requests.md, Lim 「픽셀 크기를 늘려서」 → 「픽셀이 좀더 디테일」 → 256px): 캔버스 = 판 너비, 판 밖은 잘라 냄. 외침은 세력 색을 곱함
  'boss-shout': wide(16, 0, true),
  'boss-lantern': wide(16, 0),
  'boss-shockwave': wide(16, 0),
  'boss-heartbeat': wide(20, 1),
  'boss-sandstorm': wide(22, 0),
  'boss-melt-heat': wide(22, 1),
  'boss-cream-burst': wide(20, 0),
  'boss-hush': wide(20, 1),
  'boss-door-open': wide(22, 1),
  'boss-island-tilt': wide(22, 1),
  'boss-wedge': wide(18, 1),
} as const satisfies Record<string, PxfClip>;
export type PxfKey = keyof typeof PXF;
/** 프레임 띠 그림 이름: 보스 판 전체 공격 = Codex 손그림 띠 fx-wide-*, 나머지 = 손그림풍 fx-skill-* (scripts/vfx) */
export const pxfArtName = (key: PxfKey): string => (key.startsWith('boss-') ? `fx-wide-${key.slice('boss-'.length)}` : `fx-skill-${key}`);

/** 재생할 칸: target = 대상 칸 · area = 대상 둘레 범위 안 아군 칸마다 · party = 살아 있는 파티 전원 칸마다 */
export type PxfScope = 'target' | 'area' | 'party';
/** 휠 스킬이 들어갈 때 재생할 PXF 이펙트 (그 칸의 이번 치유는 기본 치유 빛 없이) */
export const SKILL_PXF: Partial<Record<SkillKey, { fx: PxfKey; scope: PxfScope }>> = {
  heal: { fx: 'priest-heal', scope: 'target' },
  flash: { fx: 'priest-flash', scope: 'target' },
  renew: { fx: 'priest-renew', scope: 'target' },
  poh: { fx: 'priest-poh', scope: 'area' },
  purify: { fx: 'priest-purify', scope: 'target' },
  guardian: { fx: 'priest-guardian', scope: 'target' },
  hymn: { fx: 'priest-hymn', scope: 'party' },
  serenity: { fx: 'priest-serenity', scope: 'target' },
  relay: { fx: 'priest-relay', scope: 'target' },
  sprout: { fx: 'druid-sprout', scope: 'target' },
  growth: { fx: 'druid-growth', scope: 'target' },
  bloom: { fx: 'druid-bloom', scope: 'target' },
  wildflower: { fx: 'druid-wildflower', scope: 'area' },
  natureCleanse: { fx: 'druid-cleanse', scope: 'target' },
  bark: { fx: 'druid-bark', scope: 'target' },
  quietwood: { fx: 'druid-quietwood', scope: 'party' },
  rebirth: { fx: 'druid-rebirth', scope: 'target' },
  holyLight: { fx: 'paladin-holy-light', scope: 'target' },
  beacon: { fx: 'paladin-beacon', scope: 'target' }, // 봉화 지정 (84, 빛 일격 대신)
  oath: { fx: 'paladin-oath', scope: 'target' },
  lightWave: { fx: 'paladin-light-wave', scope: 'target' }, // 회복한 사람 (가장 다친 4명) 칸마다 엔진이 따로 기록 (73)
  handCleanse: { fx: 'paladin-cleanse', scope: 'target' },
  sacrifice: { fx: 'paladin-sacrifice', scope: 'target' },
  sanctuary: { fx: 'paladin-sanctuary', scope: 'area' },
  handGuard: { fx: 'paladin-hand-guard', scope: 'target' },
  ripple: { fx: 'shaman-ripple', scope: 'target' },
  droplet: { fx: 'shaman-droplet', scope: 'target' },
  washing: { fx: 'shaman-washing', scope: 'target' },
  chainHeal: { fx: 'shaman-chain', scope: 'target' }, // 튄 사람 칸마다 엔진이 따로 기록 (79 2-2)
  earthTotem: { fx: 'shaman-earth', scope: 'target' },
  rainTotem: { fx: 'shaman-rain', scope: 'party' }, // 2초마다 회복할 때마다
  spiritLink: { fx: 'shaman-link', scope: 'area' },
  springTotem: { fx: 'shaman-spring', scope: 'target' }, // 세운 칸 (사람이 없으면 칸에만, engine/shaman noteCell)
  vitalPalm: { fx: 'monk-palm', scope: 'target' },
  mistWrap: { fx: 'monk-wrap', scope: 'target' },
  wanderMist: { fx: 'monk-mist', scope: 'target' }, // 옮겨 간 칸에도 (engine/monk mistHop)
  mistBreath: { fx: 'monk-breath', scope: 'area' },
  clearChi: { fx: 'monk-clear', scope: 'target' },
  soothe: { fx: 'monk-soothe', scope: 'target' },
  reviveWind: { fx: 'monk-wind', scope: 'party' },
  tea: { fx: 'monk-tea', scope: 'target' }, // 내 칸
  starHeal: { fx: 'astro-star', scope: 'target' },
  twinkle: { fx: 'astro-twinkle', scope: 'target' },
  starMark: { fx: 'astro-mark', scope: 'target' },
  clearStar: { fx: 'astro-clear', scope: 'target' },
  starfall: { fx: 'astro-fall', scope: 'target' }, // 별 수마다 범위가 달라 회복한 칸마다 엔진이 따로 기록 (79 4-2)
  starSleep: { fx: 'astro-sleep', scope: 'target' },
  starMemory: { fx: 'astro-memory', scope: 'party' },
  polaris: { fx: 'astro-polaris', scope: 'target' },
  sealHeal: { fx: 'warder-seal', scope: 'target' },
  lightBarrier: { fx: 'warder-barrier', scope: 'target' },
  wardCleanse: { fx: 'warder-cleanse', scope: 'target' },
  wardCircle: { fx: 'warder-circle', scope: 'target' }, // 범위 (20인 2칸) 안 칸마다 엔진이 따로 기록 (79 5-2)
  guardWard: { fx: 'warder-guard', scope: 'target' },
  lightVeil: { fx: 'warder-veil', scope: 'target' }, // 장막 범위 안 칸마다 엔진이 따로 기록
  wardHold: { fx: 'warder-hold', scope: 'target' }, // 결계 굳히기 (84, 빛의 창 대신): 보호막을 늘린 아군 칸마다 (없으면 내 칸)
  judgment: { fx: 'warder-judgment', scope: 'target' }, // 회복한 인장 칸마다
};

/**
 * 그 직업 스킬의 손그림풍 이펙트 (224px 격자 띠라 하나에 2–5MB): 전투마다 지금 직업 것만 읽어 두고 다른 직업 것은 내려 놓음 (board.ts resetBoardFx)
 */
export const heroSkillFx = (hero: HeroKey): PxfKey[] =>
  [...new Set([...heroSkills(hero).map(k => SKILL_PXF[k]?.fx).filter((k): k is PxfKey => !!k), ...(HERO_LOOP_FX[hero] ?? [])])];
/** 직업별 판 위 선 물건 루프 (스킬 기록이 아님): 그 직업 전투에서만 같이 읽어 둠 */
export const HERO_LOOP_FX: Partial<Record<HeroKey, PxfKey[]>> = { shaman: ['shaman-spring-loop', 'shaman-earth-loop', 'shaman-rain-loop'], paladin: ['paladin-beacon-loop'] };
/** 루프 클립이면 지금 시각 (초)의 프레임 */
export const loopFrame = (c: PxfClip, sec: number): number => ((Math.floor(sec * c.fps) % c.frames) + c.frames) % c.frames;

/** 전투 공통 효과 (모든 효과 PXF 1단계, requests.md): 있으면 board.ts가 예전 그림 (fx-hit · fx-heal …) 대신 그림 */
export type CommonFx = 'hit' | 'crit' | 'heal' | 'dispel' | 'revive' | 'death' | 'debuff' | 'proc';
export const COMMON_PXF: Partial<Record<CommonFx, PxfKey>> = {
  hit: 'common-hit', crit: 'common-crit', heal: 'common-heal', dispel: 'common-dispel', revive: 'common-revive', death: 'common-death', debuff: 'common-debuff', proc: 'common-proc',
};
/** 파티원 능력 (엔진 ability 사건): 능력 종류마다 그 파티원 칸에 */
export const ALLY_PXF: Partial<Record<AbKind, PxfKey>> = { def: 'ally-def', ctl: 'ally-ctl', sup: 'ally-sup', heal: 'ally-heal', atk: 'ally-atk' };
/** 어느 직업 전투에서나 뜨는 손그림풍 효과 (전투 공통 · 파티원 능력): 늘 읽어 둠 (직업 스킬은 heroSkillFx로 지금 직업 것만) */
export const ALWAYS_FX: ReadonlySet<PxfKey> = new Set([...Object.values(COMMON_PXF), ...Object.values(ALLY_PXF)] as PxfKey[]);

/**
 * 보스 판 전체 공격 (board.ts FX_LOOK의 wide 연출, Lim 2026-10-11 「보스의 판 전체 공격 이펙트를 … 픽셀 크기를 늘려서」):
 * 있으면 예전 그림 (판 크기 45→100%로 키움) 대신 판 너비로 크게 한 번. 장판 · 칸마다 · 사람마다 연출은 그대로.
 * 처음엔 64px였다가 「크기는 괜찮은데 … 픽셀이 좀더 디테일 했으면」 → 128px로 다시 설계 (공방이 128px 프레임을 다 돌려주지 않아 64px 조각 4개로 확인)
 * → 우리 렌더러로 256px. 띠 하나가 4–6MB라 전투마다 그 전투에서 나올 수 있는 것만 읽어 둠 (bossPxfOf)
 */
export const BOSS_PXF: Partial<Record<string, PxfKey>> = {
  shout: 'boss-shout', lantern: 'boss-lantern', shockwave: 'boss-shockwave', heartbeat: 'boss-heartbeat', sandstorm: 'boss-sandstorm', 'melt-heat': 'boss-melt-heat',
  'cream-burst': 'boss-cream-burst', hush: 'boss-hush', 'door-open': 'boss-door-open', 'island-tilt': 'boss-island-tilt', wedge: 'boss-wedge',
};
/**
 * 이 전투에서 나올 수 있는 보스 판 전체 공격 (전투 시작에 이것만 읽어 두고 나머지는 내려 둠). 넉넉하게 고름: 빠뜨리면 그 첫 번째만 예전 그림.
 * 나오는 곳 (board.ts fxGim · fxImpact, 엔진 bossParts): 광역 기술 이름 외침 · 울부짖음 · 함성 = 외침, 등불 = 등불, 진동 · 버티기 실패 = 땅 울림,
 * 크게 뛰기 = 심장 박동 (조용히 전투는 art.ts BOSS_FX swap으로 조용히), 열기 = 열기, 기술의 hitFx · fx (모래 폭풍 · 기우는 섬 · 번개 쐐기 · 문 열림), BOSS_FX 그림 (크림 · 조용히)
 */
export function bossPxfOf(enc: Pick<Encounter, 'script' | 'mobs'>): PxfKey[] {
  const def = enc.script === 'trash' ? null : BOSSES[enc.script];
  const s = JSON.stringify([def, enc.mobs ?? null, BOSS_FX[enc.script] ?? null]);
  const on = new Set<string>(Object.keys(BOSS_PXF).filter(n => s.includes(`"hitFx":"${n}"`) || s.includes(`"fx":"${n}"`) || s.includes(`"fx-${n}"`)));
  if (/"p":"(quake|stagger)"/.test(s)) on.add('shockwave');
  if (/"p":"beat"/.test(s)) on.add('heartbeat');
  if (/"p":"melt"/.test(s)) on.add('melt-heat');
  if (/외침|울부짖|함성|"key":"(shout|howl)"/.test(s)) on.add('shout');
  if (s.includes('등불')) on.add('lantern');
  return [...on].map(n => BOSS_PXF[n]!);
}
/** 보스 판 전체 공격 PXF (전투마다 필요한 것만 읽음) */
export const isBossPxf = (k: PxfKey): boolean => k.startsWith('boss-');
/** Codex 그림 띠 (66 문서, Lim 「도트 느낌이 아닌 이펙트로」): 보스 판 전체 공격 (256 격자) */
export const wideArtName = (k: PxfKey): string => `fx-wide-${k.slice('boss-'.length)}`;
/** 띠에서 프레임 i의 왼쪽 위 (px, 띠에 구운 크기 기준) */
export const pxfCell = (c: PxfClip, i: number): { x: number; y: number } => ({ x: (i % c.cols) * c.size, y: Math.floor(i / c.cols) * c.size });

/**
 * 판 전체 그림을 판 너비 (세로로 길면 높이)로 키웠을 때 판 안에 보이는 프레임 안쪽 사각형 (px, 프레임 기준).
 * 판이 가로로 넓으면 위아래, 세로로 길면 좌우를 똑같이 잘라 냄 (픽셀은 정사각형 그대로)
 */
export function pxfCrop(c: PxfClip, w: number, h: number): { x: number; y: number; w: number; h: number } {
  const n = c.size;
  if (w >= h) { const ch = Math.max(1, Math.round((n * h) / w)); return { x: 0, y: Math.floor((n - ch) / 2), w: n, h: ch }; }
  const cw = Math.max(1, Math.round((n * w) / h));
  return { x: Math.floor((n - cw) / 2), y: 0, w: cw, h: n };
}

/** 들어간 순간부터 끝까지 길이 (ms). 맞는 순간 앞 프레임은 건너뜀 */
export const pxfMs = (c: PxfClip): number => ((c.frames - c.impactFrame) * 1000) / c.fps;
/** 들어간 뒤 ms → 프레임 번호 (끝났으면 -1) */
export function pxfFrame(c: PxfClip, ms: number): number {
  const i = c.impactFrame + Math.floor((ms * c.fps) / 1000);
  return ms < 0 || i >= c.frames ? -1 : i;
}
/** 칸 크기 (px) → 그릴 크기: 기준 칸에서 logicalSize, 칸이 크거나 작으면 그만큼 */
export const pxfDrawSize = (c: PxfClip, cell: number): number => (cell * c.logicalSize) / c.referenceCell;

/** 범위 스킬의 반경 (엔진과 같은 규칙: 기원 넓은 원 · 20인 들꽃은 엔진 값, 나머지 1칸) */
const radiusOf = (f: Fight, key: SkillKey): number => (key === 'poh' || key === 'wildflower' || key === 'mistBreath' ? areaRadius(f, key) : 1);

/** 스킬이 대상 uid에게 들어갔을 때 이펙트를 재생할 파티원들 */
export function pxfTargets(f: Fight, key: SkillKey, uid: number): Unit[] {
  const s = SKILL_PXF[key];
  if (!s) return [];
  if (s.scope === 'party') return living(f);
  const u = f.party.find(x => x.id === uid);
  if (!u) return [];
  if (s.scope === 'target') return [u];
  const c = f.cells[u.cell], r = radiusOf(f, key);
  return living(f).filter(v => v === u || hexDist(f.cells[v.cell], c) <= r);
}
