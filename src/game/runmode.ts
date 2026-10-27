/**
 * 이번 판 설정: 적 레벨 · 어픽스 (32 레벨 맞춤), 주간 도전 「모래시계 시련」 (13 3-2).
 * 적 레벨·어픽스·보스 배율·제한시간을 한곳에서 정해 전투 탭·편성·정산이 같은 값을 씀.
 * 2026-10-08 레벨 단계를 없앰: 적 레벨은 늘 내 레벨에 맞춰짐, 고르는 건 난이도 하나 (어픽스도 난이도에 붙음).
 * 2026-10-09 (34 1-2): 「2레벨 아래」 대신 적 레벨 = 내 레벨, 세기만 × 0.95 (data/rules RULES.enemy). 새 레벨 곡선은 경사가 커서 비율로 고정.
 * 2026-10-11 (61 1장, Lim): 탐험 · 던전은 레벨링 콘텐츠라 적 레벨이 장소 · 난이도에 고정 (stageOf).
 * 2026-10-21 Lim 「레이드에서 공개모집 멤버는 해당 던전에 맞는 레벨대여야한다」: 10인 · 20인도 장소 레벨에 고정 (예전엔 max(내 Lv, 열림 레벨)). 내가 높으면 던전처럼 힐러만 셈.
 */
import { diffAffixes, type AffixKey } from '../data/affixes';
import { CHAL, CHAL_ROTA, CHAL_ROTA_START, chalAffixes, chalLimit, chalMult } from '../data/challenge';
import { CHAL_DUN } from '../data/chal-dungeons';
import { CONTENT, stageOf, type ContentDef, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import type { SaveData } from '../platform/storage';
import { daysBetween, weekKey } from './clock';
import { TUT } from './tutorial';

/** 이번 주 도전 어픽스 셋 (월요일 오전 6시에 바뀜). 1 ~ 9단계는 앞 둘만 (chalAffixes, 115 나안) */
export function weekAffixes(now = Date.now()): AffixKey[] {
  const n = CHAL_ROTA.length, w = Math.floor(daysBetween(CHAL_ROTA_START, weekKey(now)) / 7);
  return CHAL_ROTA[((w % n) + n) % n].slice();
}
/** 다음 주 어픽스 (주간 도전 화면 「다음 주」) */
export const nextWeekAffixes = (now = Date.now()): AffixKey[] => weekAffixes(now + 7 * 864e5);

/**
 * 주간 도전 던전 후보 (110 2차, 2026-10-22 Lim 「기존의 던전들을 재활용하여 레벨에 맞춰서 재활용하자 (단 현재 캐릭터 레벨보다 상위 던전은 나오지 않게)」):
 * 열린 레벨이 내 레벨 이하인 던전 (해금 전 개발 빌드는 Lv 20까지), 표 (chal-dungeons)가 있는 것만
 */
export const chalPool = (lv: number): ContentKey[] =>
  CONTENT.filter(c => c.kind === 'dungeon' && c.ready && c.unlockLv <= Math.max(CHAL.lv, lv) && CHAL_DUN[c.key]).map(c => c.key as ContentKey);
/** 새 주 던전: 후보 가운데 무작위, 지난주 던전은 빼고 (후보가 하나면 그것) */
export function pickChalContent(lv: number, r: () => number, last?: ContentKey): ContentKey {
  const pool = chalPool(lv), pick = pool.length > 1 ? pool.filter(k => k !== last) : pool;
  return pick[Math.floor(r() * pick.length)];
}
/**
 * 이번 주 주간 도전 던전: 주가 바뀔 때 (economy rollover) 고른 것 (save.weekly.chal), 한 주 동안 그대로 (중간에 레벨이 올라도).
 * 없으면 (110 전 저장 · 주 시작 전) 주 번호로 고정해 고르고 적어 둠
 */
export function chalContent(save: SaveData, now = Date.now()): ContentKey {
  const w = save.weekly;
  if (w.chal && CHAL_DUN[w.chal]) return w.chal;
  const n = Math.floor(daysBetween(CHAL_ROTA_START, weekKey(now)) / 7), pool = chalPool(save.player.level);
  w.chal = pool[(((n * 7919) % pool.length) + pool.length) % pool.length];
  return w.chal;
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
 * 적 레벨 = stageOf: 탐험 · 던전 = 장소 레벨 + 난이도 (61 1-2), 레이드 = 열림 레벨 (악몽은 diffUnlock, 2026-10-21부터 내 레벨을 안 따라감). 공개모집도 이 레벨 근처 (party recruitParty stageLv).
 * 힐러 세기 = max(내 레벨, 적 레벨) (engine create: 레벨이 모자라면 스킬 · 특성만 덜 열림, 높으면 힐러만 셈).
 * 어픽스는 던전만, 적 레벨 기준 (레이드는 악몽 전용 기술, 탐험은 없음). 튜토리얼이 끝나기 전엔 콘텐츠 기본 레벨 · 어픽스 없음
 */
export function runMode(save: SaveData, c: ContentDef, d: DiffName, o: { chal: number }, now = Date.now()): RunMode {
  if (o.chal) {
    const st = Math.max(1, Math.min(CHAL.max, o.chal));
    const lv = Math.max(CHAL.lv, save.player.level), key = c.key as ContentKey;
    return { stage: lv, affixes: chalAffixes(weekAffixes(now), st), bossMult: chalMult(st, key, lv), limit: chalLimit(st, key), chal: st };
  }
  if (save.tut < TUT.done) return { stage: stageOf(c, d), affixes: [], chal: 0 };
  const stage = stageOf(c, d);
  return { stage, affixes: c.kind === 'dungeon' ? diffAffixes(d, stage) : [], chal: 0 };
}

/** 레벨로 열림. 개발 빌드(레벨 잠금 무시)는 열림 표시만 */
function gate(save: SaveData, lv: number): { ok: boolean; dev: boolean; lv: number } {
  const under = save.player.level < lv;
  return { ok: !under || save.settings.devUnlock, dev: under && save.settings.devUnlock, lv };
}
export const chalGate = (save: SaveData) => gate(save, CHAL.lv);
