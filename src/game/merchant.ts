/**
 * 행상인 (떠돌이 상인, 106, 2026-10-20 Lim 「로비에 디아블로2 갬블 요소 처럼 랜덤으로 아이템이 뜨는 컨텐츠 … 골드소비처 용도」): 미확인 장비.
 * 부위 · 종류를 골라 골드를 내면 그때 등급 · 옵션 · 특수능력을 굴림. 저장할 것 없음 (하루 횟수 · 진열 목록 · 천장 없음). 수치는 data/economy MERCHANT
 */
import { merchantGold, MERCHANT } from '../data/economy';
import { descending, dropTable, heroRamp, ITEM_GRADES, kindsOf, makeItem, rollGrade, SLOTS, type GearItem, type SlotKey } from '../data/equipment';
import { noteSpecs, type SaveData } from '../platform/storage';
import { resourceBalance, spendResource } from './resources';
import { TUT } from './tutorial';

/** 등급 확률 (ITEM_GRADES 순): 그 레벨 MERCHANT.diff 바탕 표에서 영웅 몫만큼 덜고 영웅 (Lv 45부터), 전설 0 */
export function merchantOdds(lv: number): number[] {
  const hero = MERCHANT.hero * heroRamp(lv), out = dropTable(MERCHANT.diff, 0, lv).map(p => p * (1 - hero));
  out[ITEM_GRADES.indexOf('영웅')] += hero;
  return descending(out);
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
  const lv = save.player.level, gold = merchantGold();
  const lock = save.tut < TUT.done ? '튜토리얼을 마치면 열림'
    : lv < MERCHANT.lv && !save.settings.devUnlock ? `Lv ${MERCHANT.lv}에 열림` : '';
  const why = lock || (resourceBalance(save, 'gold') < gold ? '골드 부족' : '');
  return { lv, gold, open: !lock, lock, ok: !why, why };
}

/** 미확인 장비 사기: 그 부위 · 종류로 등급을 굴려 가방에 넣음. 성공 = 장비, 아니면 이유 */
export function buyUnknown(save: SaveData, slot: SlotKey, kind: string, r: () => number = Math.random): GearItem | string {
  if (!SLOTS.some(s => s.key === slot) || !kindsOf(slot).some(k => k.key === kind)) return '없는 장비';
  const o = merchantOffer(save);
  if (!o.ok) return o.why;
  spendResource(save, 'gold', o.gold);
  const it = makeItem(r, slot, rollGrade(r, merchantOdds(o.lv)), save.nextId++, kind, { hero: save.hero, classLoot: true, lv: o.lv }); // 지금 직업 전용 70% (72)
  save.gear.bag.push(it);
  noteSpecs(save, [it]);
  return it;
}
