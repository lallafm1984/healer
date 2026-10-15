/** 소비 아이템의 화면 배치. 엔진에 넘길 아이템 목록과 빈칸을 포함한 저장 배치를 분리한다. */
import { ITEMS, type ItemKey } from './items';
import { ITEM_SLOT_COUNT, itemSlots } from './progression';

export type ItemSlot = ItemKey | null;
export { ITEM_SLOT_COUNT };
// 이전 3·4번 칸은 저장에 보존하되 선택·전투에서는 사용하지 않는다.
const STORED_ITEM_SLOTS = 4;
const validItem = (key: unknown): key is ItemKey => typeof key === 'string' && Object.hasOwn(ITEMS, key);

/** 옛 압축 배열도 같은 순서로 읽고, 잘못된 값·중복은 그 자리의 빈칸으로 남긴다. */
export function itemLoadoutOf(value: unknown): ItemSlot[] {
  const source = Array.isArray(value) ? value : [], seen = new Set<ItemKey>();
  return Array.from({ length: STORED_ITEM_SLOTS }, (_, i) => {
    // 활성 칸에서 같은 종류를 골라도 숨은 저장값은 지우지 않는다.
    if (i === ITEM_SLOT_COUNT) seen.clear();
    const key: unknown = source[i];
    if (!validItem(key) || seen.has(key)) return null;
    seen.add(key);
    return key;
  });
}

/** 기존 숨은 칸의 설정은 보존하되 전투에는 앞의 두 칸만 보낸다. */
export function activeItemKeys(loadout: readonly ItemSlot[], level: number): ItemKey[] {
  return loadout.slice(0, itemSlots(level)).filter((key): key is ItemKey => key !== null);
}

/** 다른 칸에 이미 있는 아이템은 교환한다. 빈 목표 칸이면 기존 자리에서 이동한다. */
export function assignItemSlot(value: unknown, level: number, slot: number, key: unknown): { loadout: ItemSlot[]; msg: string } {
  const loadout = itemLoadoutOf(value);
  if (!Number.isInteger(slot) || slot < 0 || slot >= itemSlots(level)) return { loadout, msg: '사용할 수 없는 칸' };
  if (key !== null && !validItem(key)) return { loadout, msg: '알 수 없는 아이템' };
  const from = key === null ? -1 : loadout.slice(0, ITEM_SLOT_COUNT).indexOf(key);
  if (from !== -1 && from !== slot) loadout[from] = loadout[slot];
  loadout[slot] = key;
  return { loadout, msg: '' };
}
