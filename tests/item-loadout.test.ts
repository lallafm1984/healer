import { afterEach, describe, expect, it } from 'vitest';
import { activeItemKeys, assignItemSlot, itemLoadoutOf, ITEM_SLOT_COUNT } from '../src/data/item-loadout';
import { create, useItem } from '../src/engine';
import { G, itemsNow, setItemSlot, toggleItem } from '../src/game/state';
import { load, migrate, newSave, save, type KV } from '../src/platform/storage';

describe('소비 아이템 두 단축칸과 이전 저장 보존', () => {
  it('화면은 두 칸이며 이전 저장의 3·4번 칸도 읽어서 보존한다', () => {
    expect(ITEM_SLOT_COUNT).toBe(2);
    expect(itemLoadoutOf(['life', 'mana'])).toEqual(['life', 'mana', null, null]);
    expect(itemLoadoutOf(['mana', 'life', 'shield', 'feather'])).toEqual(['mana', 'life', 'shield', 'feather']);
    expect(itemLoadoutOf([42, { key: 'life' }, 'toString', 'cleanse'])).toEqual([null, null, null, 'cleanse']);
    expect(itemLoadoutOf(['mana', 'mana', 'shield', 'shield'])).toEqual(['mana', null, 'shield', null]);
    expect(itemLoadoutOf(null)).toEqual([null, null, null, null]);
  });

  it('활성 두 칸끼리는 교환하고 이전 숨은 칸을 수정하지 않는다', () => {
    const old = ['mana', 'life', 'shield', 'feather'];
    expect(assignItemSlot(old, 100, 1, 'mana').loadout).toEqual(['life', 'mana', 'shield', 'feather']);
    const picked = assignItemSlot(old, 100, 0, 'shield').loadout;
    expect(picked).toEqual(['shield', 'life', 'shield', 'feather']);
    expect(itemLoadoutOf(picked)).toEqual(picked);
    expect(old).toEqual(['mana', 'life', 'shield', 'feather']);
  });

  it('빈칸 이동·교체·해제는 선택한 활성 칸만 변경한다', () => {
    const moved = assignItemSlot(['mana', null, 'shield', 'feather'], 30, 1, 'mana').loadout;
    expect(moved).toEqual([null, 'mana', 'shield', 'feather']);
    expect(assignItemSlot(moved, 30, 1, null).loadout).toEqual([null, null, 'shield', 'feather']);
    expect(assignItemSlot(['mana', 'life'], 1, 1, 'life').loadout).toEqual(['mana', 'life', null, null]);
  });

  it('어느 레벨에서도 세 번째 이후 칸과 잘못된 아이템을 지정할 수 없다', () => {
    for (const level of [1, 15, 30, 100]) {
      for (const slot of [-1, 2, 3, 4, 1.5, NaN]) expect(assignItemSlot(['mana', 'life'], level, slot, 'shield').msg).not.toBe('');
      expect(assignItemSlot(['mana', 'life'], level, 1, 'shield').msg).toBe('');
    }
    expect(assignItemSlot(['mana', 'life'], 100, 1, 'unknown').loadout).toEqual(['mana', 'life', null, null]);
    expect(assignItemSlot(['mana', 'life'], 100, 1, 'unknown').msg).not.toBe('');
  });

  it('이전 숨은 설정을 보존하되 전투 선택과 엔진 사용은 두 칸으로 제한한다', () => {
    const config = itemLoadoutOf(['mana', null, 'shield', 'feather']);
    for (const level of [1, 15, 30, 100]) expect(activeItemKeys(config, level)).toEqual(['mana']);
    expect(config).toEqual(['mana', null, 'shield', 'feather']);
    const f = create({ encounter: 'warden', diff: '보통', items: ['mana', 'life', 'shield', 'feather'], seed: 1 });
    expect(Object.keys(f.items)).toEqual(['mana', 'life']);
    const before = { ...f.items };
    useItem(f, 'shield', f.party[0].cell);
    expect(f.items).toEqual(before);
    expect(f.itemLog).toHaveLength(0);
  });

  it('저장·재진입·이관 시 숨은 설정과 보유 아이템을 삭제하지 않는다', () => {
    const data: Record<string, string> = {};
    const kv: KV = { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
    const s = newSave(); s.items = [null, 'cleanse', null, 'life']; s.bag.shield = 9;
    expect(save(s, kv)).toBe(true);
    expect(load(kv).items).toEqual(s.items);
    expect(load(kv).bag.shield).toBe(9);
    expect(migrate({ ...s, v: 9 }).items).toEqual(s.items);
    expect(migrate({ ...s, v: 1, items: ['life', 'mana'] }).items).toEqual(['life', 'mana']);
  });
});

describe('편성과 전투가 공유하는 두 단축칸', () => {
  const original = G.save;
  afterEach(() => { G.save = original; });
  it('편집 후 두 활성 칸과 숨은 저장값·보유량을 함께 보존한다', () => {
    G.save = newSave(); G.save.player.level = 100;
    G.save.items = ['mana', 'life', 'shield', 'feather']; G.save.bag.shield = 8;
    expect(setItemSlot(1, 'shield')).toBe('');
    expect(itemsNow()).toEqual({ slots: 2, items: ['mana', 'shield'], loadout: ['mana', 'shield', 'shield', 'feather'] });
    expect(setItemSlot(2, null)).not.toBe('');
    expect(G.save.items).toEqual(['mana', 'shield', 'shield', 'feather']);
    expect(G.save.bag.shield).toBe(8);
  });
  it('옛 toggle 호출도 활성 두 칸에만 지정하고 숨은 칸을 남긴다', () => {
    G.save = newSave(); G.save.items = ['mana', 'life', 'shield', 'feather'];
    expect(toggleItem('cleanse')).not.toBe('');
    expect(toggleItem('mana')).toBe('');
    expect(toggleItem('cleanse')).toBe('');
    expect(G.save.items).toEqual(['cleanse', 'life', 'shield', 'feather']);
  });
});
