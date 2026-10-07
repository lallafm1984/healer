/**
 * 이번 판 설정: 던전 레벨 단계 (07 3장), 주간 도전 「침묵의 시계」 (13 3-2).
 * 단계 레벨·어픽스·보스 배율·제한시간을 한곳에서 정해 입장·편성·정산이 같은 값을 씀.
 */
import { LEVEL_TIERS, tierAffixes, type AffixKey } from '../data/affixes';
import { CHAL, CHAL_ROTA, chalLimit, chalMult } from '../data/challenge';
import { stageOf, type ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { SEASON } from '../data/economy';
import type { SaveData } from '../platform/storage';
import { daysBetween, weekKey } from './clock';

/** 이번 주 도전 어픽스 (월요일 오전 6시에 바뀜) */
export function weekAffixes(now = Date.now()): AffixKey[] {
  const n = CHAL_ROTA.length, w = Math.floor(daysBetween(SEASON.start, weekKey(now)) / 7);
  return CHAL_ROTA[((w % n) + n) % n].slice();
}

export interface RunMode {
  /** 단계 레벨 (보상·적 배율) */
  stage: number;
  affixes: AffixKey[];
  bossMult?: { hp: number; dmg: number };
  /** 제한시간 (초, 주간 도전만) */
  limit?: number;
  /** 주간 도전 단계 (0 = 아님) */
  chal: number;
  /** 던전 레벨 단계 (0 = 기본) */
  tier: number;
}

export function runMode(save: SaveData, c: ContentDef, d: DiffName, o: { tier: number; chal: number }, now = Date.now()): RunMode {
  if (o.chal) {
    const st = Math.max(1, Math.min(CHAL.max, o.chal));
    return { stage: Math.max(CHAL.lv, save.player.level), affixes: weekAffixes(now), bossMult: chalMult(st), limit: chalLimit(st), chal: st, tier: 0 };
  }
  const tier = c.tiers?.includes(o.tier) ? o.tier : 0;
  return { stage: stageOf(c, d, tier), affixes: tierAffixes(tier), chal: 0, tier };
}

/** 레벨로 열림. 개발 빌드(레벨 잠금 무시)는 열림 표시만 */
function gate(save: SaveData, lv: number): { ok: boolean; dev: boolean; lv: number } {
  const under = save.player.level < lv;
  return { ok: !under || save.settings.devUnlock, dev: under && save.settings.devUnlock, lv };
}
export const tierGate = (save: SaveData, tier: number) => gate(save, tier);
export const chalGate = (save: SaveData) => gate(save, CHAL.lv);
export { LEVEL_TIERS };
