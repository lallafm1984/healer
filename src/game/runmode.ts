/**
 * 이번 판 설정: 적 레벨 · 어픽스 (32 레벨 맞춤), 주간 도전 「모래시계 시련」 (13 3-2).
 * 적 레벨·어픽스·보스 배율·제한시간을 한곳에서 정해 전투 탭·편성·정산이 같은 값을 씀.
 * 2026-10-08 레벨 단계를 없앰: 적 레벨은 늘 내 레벨에 맞춰짐, 고르는 건 난이도 하나 (어픽스도 난이도에 붙음).
 * 2026-10-09 (34 1-2): 「2레벨 아래」 대신 적 레벨 = 내 레벨, 세기만 × 0.95 (data/rules RULES.enemy). 새 레벨 곡선은 경사가 커서 비율로 고정.
 */
import { diffAffixes, type AffixKey } from '../data/affixes';
import { CHAL, CHAL_ROTA, chalLimit, chalMult } from '../data/challenge';
import { stageOf, type ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { SEASON } from '../data/economy';
import type { SaveData } from '../platform/storage';
import { daysBetween, weekKey } from './clock';
import { TUT } from './tutorial';

/** 이번 주 도전 어픽스 (월요일 오전 6시에 바뀜) */
export function weekAffixes(now = Date.now()): AffixKey[] {
  const n = CHAL_ROTA.length, w = Math.floor(daysBetween(SEASON.start, weekKey(now)) / 7);
  return CHAL_ROTA[((w % n) + n) % n].slice();
}

export interface RunMode {
  /** 적 레벨 (파티원·적 배율, 보상) */
  stage: number;
  affixes: AffixKey[];
  bossMult?: { hp: number; dmg: number };
  /** 제한시간 (초, 주간 도전만) */
  limit?: number;
  /** 주간 도전 단계 (0 = 아님) */
  chal: number;
}

/**
 * 적 레벨 = 내 레벨 (34 1-2, 세기는 엔진이 × 0.95). 콘텐츠 열림 레벨보다 낮으면 열림 레벨 (개발 빌드로 먼저 들어가도 열림 레벨).
 * 어픽스는 던전만 (레이드는 악몽 전용 기술, 탐험은 없음). 튜토리얼이 끝나기 전엔 콘텐츠 기본 레벨 · 어픽스 없음
 */
export function runMode(save: SaveData, c: ContentDef, d: DiffName, o: { chal: number }, now = Date.now()): RunMode {
  if (o.chal) {
    const st = Math.max(1, Math.min(CHAL.max, o.chal));
    return { stage: Math.max(CHAL.lv, save.player.level), affixes: weekAffixes(now), bossMult: chalMult(st), limit: chalLimit(st), chal: st };
  }
  if (save.tut < TUT.done) return { stage: stageOf(c, d), affixes: [], chal: 0 };
  const lv = save.player.level;
  return { stage: Math.max(lv, stageOf(c, d)), affixes: c.kind === 'dungeon' ? diffAffixes(d, lv) : [], chal: 0 };
}

/** 레벨로 열림. 개발 빌드(레벨 잠금 무시)는 열림 표시만 */
function gate(save: SaveData, lv: number): { ok: boolean; dev: boolean; lv: number } {
  const under = save.player.level < lv;
  return { ok: !under || save.settings.devUnlock, dev: under && save.settings.devUnlock, lv };
}
export const chalGate = (save: SaveData) => gate(save, CHAL.lv);
