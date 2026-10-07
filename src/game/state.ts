/** 게임 진행 상태 (기기 저장 한 덩어리) + 화면들이 같이 쓰는 규칙 */
import type { ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { SLOTS, type GearItem } from '../data/equipment';
import { ITEMS, type ItemKey } from '../data/items';
import { itemSlots } from '../data/progression';
import { load, newSave, save, type SaveData } from '../platform/storage';

export const G: { save: SaveData } = { save: load() };

export function commit(): void { save(G.save); }

export function resetSave(): void { G.save = newSave(); commit(); }

/** 전투에 넘길 힐러 레벨 (스킬 해금 기준). 개발 빌드 「스킬 전부 열기」면 100 */
export const healerLevel = () => (G.save.settings.allSkills ? 100 : G.save.player.level);

/** 잠금: 콘텐츠·난이도 해금 레벨. dev = 개발 빌드 잠금 무시 */
export function lockOf(c: ContentDef, d?: DiffName): { lv: number; locked: boolean; dev: boolean } {
  const lv = Math.max(c.unlockLv, (d && c.diffUnlock?.[d]) || 0);
  const under = G.save.player.level < lv;
  const dev = under && G.save.settings.devUnlock && c.ready;
  return { lv, locked: under && !dev, dev };
}

/** 지금 쓸 수 있는 단축칸 구성 (열린 칸 수만큼) */
export function itemsNow() {
  const n = itemSlots(G.save.player.level);
  return { slots: n, items: G.save.items.slice(0, n) };
}

/** 단축칸에 아이템 넣기/빼기 (편성·캐릭터 화면). 칸이 다 찼으면 안내 문구를 돌려줌 */
export function toggleItem(k: ItemKey): string {
  const { slots, items } = itemsNow();
  let msg = '';
  if (items.includes(k)) G.save.items = items.filter(x => x !== k);
  else if (items.length >= slots) msg = `단축칸 ${slots}칸이 가득 참. 뺄 아이템부터 누르기`;
  else G.save.items = (Object.keys(ITEMS) as ItemKey[]).filter(x => x === k || items.includes(x));
  commit();
  return msg;
}

/** 가방의 장비를 착용. 원래 끼던 것은 가방으로 */
export function equip(id: number): GearItem | null {
  const g = G.save.gear;
  const i = g.bag.findIndex(x => x.id === id);
  if (i < 0) return null;
  const it = g.bag[i];
  const old = g.equipped[it.slot];
  g.bag.splice(i, 1);
  if (old) g.bag.push(old);
  g.equipped[it.slot] = it;
  commit();
  return old || null;
}

export const emptySlots = () => SLOTS.filter(s => !G.save.gear.equipped[s.key]).length;
