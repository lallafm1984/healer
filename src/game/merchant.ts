/**
 * 행상인 (떠돌이 상인, 106, 2026-10-20 Lim 「로비에 디아블로2 갬블 요소 처럼 랜덤으로 아이템이 뜨는 컨텐츠 … 골드소비처 용도」): 미확인 장비.
 * 부위를 골라 골드를 내면 그때 종류 (그 부위 다섯 가지 중 고르게) · 등급 · 옵션 · 특수능력을 굴림 (2026-10-20 Lim 「부위만 고르게」). 저장할 것 없음 (하루 횟수 · 진열 목록 · 천장 없음). 수치는 data/economy MERCHANT
 */
import { MERCHANT } from '../data/economy';
import { MAX_LEVEL } from '../data/progression';
import { HERO_FROM, ITEM_GRADES, makeItem, rollGrade, SLOTS, type GearItem, type SlotKey } from '../data/equipment';
import type { SaveData } from '../platform/storage';
import { runGold } from './economy';
import { resourceBalance, spendResource } from './resources';
import { TUT } from './tutorial';

/** 미확인 장비 한 개 값: 그 레벨 가장 큰 콘텐츠 한 판 골드 (runGold)에 비례, Lv 100에 MERCHANT.top, 10골드 단위 (2026-10-21 Lim 「레이드 획득 골드의 20배 정도」) */
export const merchantGold = (lv: number): number => Math.round((MERCHANT.top * runGold(lv)) / runGold(MAX_LEVEL) / 10) * 10;

/** 등급 확률 (ITEM_GRADES 순): MERCHANT.odds 그대로 (레벨 상관없음), 영웅은 Lv 45 (HERO_FROM)부터 · 그 전엔 영웅 몫이 희귀로, 전설 0 */
export function merchantOdds(lv: number): number[] {
  const out = MERCHANT.odds.slice(), hero = ITEM_GRADES.indexOf('영웅');
  if (lv < HERO_FROM) { out[hero - 1] += out[hero]; out[hero] = 0; }
  return out;
}

export interface MerchantOffer {
  /** 장비 레벨 (지금 직업 레벨) · 한 개 값 */
  lv: number; gold: number;
  /** 열림 (튜토리얼 끝 · Lv MERCHANT.lv) / 아니면 이유 */
  open: boolean; lock: string;
  /** 살 수 있음 / 아니면 이유 (잠김 · 골드 부족) */
  ok: boolean; why: string;
}

export function merchantOffer(save: SaveData): MerchantOffer {
  const lv = save.player.level, gold = merchantGold(lv);
  const lock = save.tut < TUT.done ? '튜토리얼을 마치면 열림'
    : lv < MERCHANT.lv && !save.settings.devUnlock ? `Lv ${MERCHANT.lv}에 열림` : '';
  const why = lock || (resourceBalance(save, 'gold') < gold ? '골드 부족' : '');
  return { lv, gold, open: !lock, lock, ok: !why, why };
}

/** 미확인 장비 사기: 그 부위로 종류 · 등급을 굴려 가방에 넣음. 성공 = 장비, 아니면 이유 */
export function buyUnknown(save: SaveData, slot: SlotKey, r: () => number = Math.random): GearItem | string {
  if (!SLOTS.some(s => s.key === slot)) return '없는 부위';
  const o = merchantOffer(save);
  if (!o.ok) return o.why;
  spendResource(save, 'gold', o.gold);
  const it = makeItem(r, slot, rollGrade(r, merchantOdds(o.lv)), save.nextId++, undefined, { hero: save.hero, classLoot: true, lv: o.lv }); // 지금 직업 전용 70% (72)
  save.gear.bag.push(it);
  return it;
}
