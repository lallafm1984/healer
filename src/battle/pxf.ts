/**
 * PXF 공방 이펙트 (pxf.graph@1): 그래프 원본은 src/art/pxf/<이름>.pxf.json, 요청문은 src/art/pxf/requests.md.
 * 게임에는 PXF 엔진이 없어서 실제 엔진이 그린 프레임을 투명 띠로 구워 둔 src/art/fx-pxf-<이름>.png
 * (64px 프레임을 가로로 frames장, 굽기 scripts/pxf-strip.mjs)를 그린다. 보스 판 전체 공격은 128px로 설계해 (공방 확인은 64px 조각 4개, scripts/pxf-tiles.mjs)
 * 우리 렌더러 (scripts/fxr.mjs)로 256px 프레임을 격자 (cols열)로 구운 띠.
 * 값은 그래프의 settings · game 블록과 같아야 함 (tests/pxf.test.ts).
 * 2026-10-11 Lim: 사제 치유로 시험 → 「직업별 모든 스킬에」 → 전투 공통 효과 · 파티원 능력 · 보스 판 전체 공격도. 보통 섞기 · 모두 판 맨 위 층 (board.ts pxfL, Lim 「파티원에서 최상단으로」)
 */
import type { AbKind } from '../data/abilities';
import { BOSSES } from '../data/bosses';
import type { Encounter } from '../data/encounters';
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

const clip = (frames: number, impactFrame: number, gray = false): PxfClip =>
  ({ size: 64, frames, fps: 24, cols: frames, blend: 'normal', impactFrame, logicalSize: 64, referenceCell: 62, gray });
/** 보스 판 전체 공격 그래프의 캔버스 (settings.size · game.logicalSize) */
export const WIDE_DESIGN = 128;
/**
 * 보스 판 전체 공격: 128px로 설계해 우리 렌더러 (scripts/fxr.mjs)로 256px로 구움 (Lim 2026-10-11 「전체공격의 픽셀이 좀더 디테일 했으면」
 * → 「공방처럼 더 고해상도로 만들 수 있는 툴」 → 256px). 프레임은 거의 정사각형 격자로 (22장 = 5×5, 1280px)
 */
const wide = (frames: number, impactFrame: number, gray = false): PxfClip =>
  ({ ...clip(frames, impactFrame, gray), size: 256, cols: Math.ceil(Math.sqrt(frames)), logicalSize: WIDE_DESIGN });

/** 이름 = 그래프 · 프레임 띠 파일 이름 (src/art/pxf/<이름>.pxf.json → fx-pxf-<이름>.png) */
export const PXF = {
  /** 치유 초록 반짝이 가루 (Lim이 만든 그래프). 그래프는 더하기 섞기지만 Lim 2026-10-11 「원본 색이 잘 보이게」 → 보통 섞기 */
  'heal-dust': clip(24, 2),
  // 아래는 Claude가 요청문 (requests.md)마다 그래프를 만들어 렌더링 · 확인한 것 (2026-10-11)
  'priest-flash': clip(14, 1),
  'priest-renew': clip(24, 2),
  'priest-poh': clip(20, 2),
  'priest-purify': clip(18, 0),
  'priest-guardian': clip(24, 4),
  'priest-hymn': clip(20, 1),
  'priest-serenity': clip(24, 1),
  'priest-sanctify': clip(20, 2),
  'priest-relay': clip(20, 0),
  'druid-sprout': clip(20, 2),
  'druid-growth': clip(20, 2),
  'druid-bloom': clip(18, 3),
  'druid-wildflower': clip(24, 2),
  'druid-cleanse': clip(18, 2),
  'druid-bark': clip(24, 4),
  'druid-quietwood': clip(24, 2),
  'druid-rebirth': clip(24, 2),
  'paladin-holy-light': clip(22, 2),
  'paladin-holy-strike': clip(16, 2),
  'paladin-oath': clip(24, 2),
  'paladin-light-wave': clip(18, 2),
  'paladin-cleanse': clip(18, 2),
  'paladin-sacrifice': clip(22, 3),
  'paladin-sanctuary': clip(24, 3),
  'paladin-hand-guard': clip(24, 2),
  // 모든 효과 PXF 1단계 (requests.md): 전투 공통 효과 (회색 그림은 색을 곱함)
  'common-hit': clip(11, 0),
  'common-crit': clip(12, 0),
  'common-heal': clip(14, 1, true),
  'common-dispel': clip(14, 1),
  'common-revive': clip(20, 1),
  'common-death': clip(18, 0, true),
  'common-debuff': clip(16, 1, true),
  'common-proc': clip(12, 0, true),
  // 모든 효과 PXF 1단계 (requests.md): 파티원 능력 종류마다
  'ally-def': clip(16, 1),
  'ally-ctl': clip(16, 1),
  'ally-sup': clip(16, 1),
  'ally-heal': clip(16, 1),
  'ally-atk': clip(14, 0),
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
export const pxfArtName = (key: PxfKey): string => `fx-pxf-${key}`;

/** 재생할 칸: target = 대상 칸 · area = 대상 둘레 범위 안 아군 칸마다 · party = 살아 있는 파티 전원 칸마다 */
export type PxfScope = 'target' | 'area' | 'party';
/** 휠 스킬이 들어갈 때 재생할 PXF 이펙트 (그 칸의 이번 치유는 기본 치유 빛 없이) */
export const SKILL_PXF: Partial<Record<SkillKey, { fx: PxfKey; scope: PxfScope }>> = {
  heal: { fx: 'heal-dust', scope: 'target' },
  flash: { fx: 'priest-flash', scope: 'target' },
  renew: { fx: 'priest-renew', scope: 'target' },
  poh: { fx: 'priest-poh', scope: 'area' },
  purify: { fx: 'priest-purify', scope: 'target' },
  guardian: { fx: 'priest-guardian', scope: 'target' },
  hymn: { fx: 'priest-hymn', scope: 'party' },
  serenity: { fx: 'priest-serenity', scope: 'target' },
  sanctify: { fx: 'priest-sanctify', scope: 'area' },
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
  holyStrike: { fx: 'paladin-holy-strike', scope: 'target' },
  oath: { fx: 'paladin-oath', scope: 'target' },
  lightWave: { fx: 'paladin-light-wave', scope: 'area' },
  handCleanse: { fx: 'paladin-cleanse', scope: 'target' },
  sacrifice: { fx: 'paladin-sacrifice', scope: 'target' },
  sanctuary: { fx: 'paladin-sanctuary', scope: 'area' },
  handGuard: { fx: 'paladin-hand-guard', scope: 'target' },
};

/** 전투 공통 효과 (모든 효과 PXF 1단계, requests.md): 있으면 board.ts가 예전 그림 (fx-hit · fx-heal …) 대신 그림 */
export type CommonFx = 'hit' | 'crit' | 'heal' | 'dispel' | 'revive' | 'death' | 'debuff' | 'proc';
export const COMMON_PXF: Partial<Record<CommonFx, PxfKey>> = {
  hit: 'common-hit', crit: 'common-crit', heal: 'common-heal', dispel: 'common-dispel', revive: 'common-revive', death: 'common-death', debuff: 'common-debuff', proc: 'common-proc',
};
/** 파티원 능력 (엔진 ability 사건): 능력 종류마다 그 파티원 칸에 */
export const ALLY_PXF: Partial<Record<AbKind, PxfKey>> = { def: 'ally-def', ctl: 'ally-ctl', sup: 'ally-sup', heal: 'ally-heal', atk: 'ally-atk' };

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
/** Codex 그림 띠 (66 문서, Lim 「도트 느낌이 아닌 이펙트로」): 보스 판 전체 공격과 같은 256 격자 · 프레임, 파일이 있으면 PXF 띠 대신 씀 */
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
const radiusOf = (f: Fight, key: SkillKey): number => (key === 'poh' || key === 'wildflower' ? areaRadius(f, key) : 1);

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
