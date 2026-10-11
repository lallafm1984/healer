/**
 * PXF 공방 이펙트 (pxf.graph@1, Lim 2026-10-11 시험): 그래프 원본은 src/art/pxf/<이름>.pxf.json.
 * 게임에는 PXF 엔진이 없어서 실제 엔진이 그린 프레임을 투명 띠로 구워 둔 src/art/fx-pxf-<이름>.png
 * (64px 프레임을 가로로 frames장, 굽기 scripts/pxf-strip.mjs)를 그린다.
 * 값은 그래프의 settings · game 블록과 같아야 함 (tests/pxf.test.ts).
 */
import type { SkillKey } from '../data/skills';
import type { Cast } from '../engine/types';

export interface PxfClip {
  /** 프레임 띠 그림 이름 */
  art: string;
  /** 프레임 한 장 크기 (px) · 장 수 · 초당 장 수 */
  size: number;
  frames: number;
  fps: number;
  /** 섞기 (game.blend, 게임에서 바꿀 수 있음): add = 더하기 (밝은 칸에선 흰빛으로 보임), normal = 원본 색 그대로 */
  blend: 'add' | 'normal';
  /** 맞는 순간 프레임 (game.impactFrame): 치유가 들어간 순간이 이 프레임 */
  impactFrame: number;
  /** 기준 칸 크기 (game.referenceCell)일 때 그림 크기 (game.logicalSize) */
  logicalSize: number;
  referenceCell: number;
}

export const PXF = {
  /** 치유 초록 반짝이 가루 (64px · 24장 · 24fps · 맞는 순간 2). 그래프는 더하기 섞기지만 Lim 2026-10-11 「원본 색이 잘 보이게」 → 보통 섞기 */
  healDust: { art: 'fx-pxf-heal-dust', size: 64, frames: 24, fps: 24, blend: 'normal', impactFrame: 2, logicalSize: 64, referenceCell: 62 },
} as const satisfies Record<string, PxfClip>;
export type PxfKey = keyof typeof PXF;

/** 스킬이 대상에게 들어갈 때 기본 치유 빛 대신 쓰는 PXF 이펙트 (시험: 사제 치유만) */
export const SKILL_PXF: Partial<Record<SkillKey, PxfKey>> = { heal: 'healDust' };

/** 들어간 순간부터 끝까지 길이 (ms). 맞는 순간 앞 프레임은 건너뜀 */
export const pxfMs = (c: PxfClip): number => ((c.frames - c.impactFrame) * 1000) / c.fps;
/** 들어간 뒤 ms → 프레임 번호 (끝났으면 -1) */
export function pxfFrame(c: PxfClip, ms: number): number {
  const i = c.impactFrame + Math.floor((ms * c.fps) / 1000);
  return ms < 0 || i >= c.frames ? -1 : i;
}
/** 칸 크기 (px) → 그릴 크기: 기준 칸에서 logicalSize, 칸이 크거나 작으면 그만큼 */
export const pxfDrawSize = (c: PxfClip, cell: number): number => (cell * c.logicalSize) / c.referenceCell;

/**
 * 지난 프레임에 걸려 있던 시전이 이번 프레임에 끝까지 들어갔으면 그 스킬의 이펙트와 대상.
 * 엔진은 시전이 끝날 때 남은 시간을 0까지 깎고 나서 비우고, 취소는 남은 시간을 그대로 둔 채 비움
 */
export function landedPxf(before: Cast | null, now: Cast | null): { key: PxfKey; uid: number } | null {
  if (!before || before === now || before.left > 1e-9) return null;
  const key = SKILL_PXF[before.key];
  return key ? { key, uid: before.uid } : null;
}
