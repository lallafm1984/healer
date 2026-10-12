import { afterEach, describe, expect, it } from 'vitest';
import { activeItemKeys, assignItemSlot, itemLoadoutOf } from '../src/data/item-loadout';
import { create } from '../src/engine';
import { G, itemsNow, setItemSlot, toggleItem } from '../src/game/state';
import { load, migrate, newSave, save, type KV } from '../src/platform/storage';

describe('소비 아이템 단축칸 위치', () => {
  it('기존 압축 저장 배열의 순서를 그대로 네 칸에 표시한다', () => {
    expect(itemLoadoutOf(['life', 'mana'])).toEqual(['life', 'mana', null, null]);
  });

  it('깨진 값과 중복을 제거해도 뒤 아이템을 앞으로 당기지 않는다', () => {
    expect(itemLoadoutOf(['bad-item', 'mana', 'mana', 'feather', 'life'])).toEqual([null, 'mana', null, 'feather']);
    expect(itemLoadoutOf([42, { key: 'life' }, 'toString', 'cleanse'])).toEqual([null, null, null, 'cleanse']);
    expect(itemLoadoutOf(null)).toEqual([null, null, null, null]);
  });

  it('선택한 네 번째 빈칸에 넣고 앞 빈칸을 그대로 둔다', () => {
    const result = assignItemSlot(['mana', null, null, null], 30, 3, 'life');
    expect(result).toEqual({ loadout: ['mana', null, null, 'life'], msg: '' });
  });

  it('이미 다른 칸에 있는 아이템은 선택한 칸과 교환한다', () => {
    const old = ['mana', 'life', 'shield', 'feather'];
    expect(assignItemSlot(old, 30, 3, 'mana').loadout).toEqual(['feather', 'life', 'shield', 'mana']);
    expect(old).toEqual(['mana', 'life', 'shield', 'feather']);
  });

  it('빈칸으로 이동하면 원래 자리를 비우고, 해제는 해당 칸만 비운다', () => {
    const moved = assignItemSlot(['mana', 'life', null, 'feather'], 30, 2, 'mana').loadout;
    expect(moved).toEqual([null, 'life', 'mana', 'feather']);
    expect(assignItemSlot(moved, 30, 1, null).loadout).toEqual([null, null, 'mana', 'feather']);
  });

  it('선택된 아이템을 다시 고르면 유지하고, 새 아이템은 그 칸만 교체한다', () => {
    expect(assignItemSlot(['mana', 'life'], 1, 1, 'life').loadout).toEqual(['mana', 'life', null, null]);
    expect(assignItemSlot(['mana', 'life'], 1, 1, 'shield').loadout).toEqual(['mana', 'shield', null, null]);
  });

  it('기존 Lv15·30 잠금을 유지하고 비정상 칸/아이템 지정은 거부한다', () => {
    expect(assignItemSlot(['mana', 'life'], 14, 2, 'shield').msg).not.toBe('');
    expect(assignItemSlot(['mana', 'life'], 15, 2, 'shield').msg).toBe('');
    expect(assignItemSlot(['mana', 'life'], 29, 3, 'shield').msg).not.toBe('');
    expect(assignItemSlot(['mana', 'life'], 30, 3, 'shield').msg).toBe('');
    for (const slot of [-1, 4, 1.5, NaN]) expect(assignItemSlot(['mana', 'life'], 100, slot, 'shield').msg).not.toBe('');
    expect(assignItemSlot(['mana', 'life'], 100, 1, 'unknown').loadout).toEqual(['mana', 'life', null, null]);
    expect(assignItemSlot(['mana', 'life'], 100, 1, 'unknown').msg).not.toBe('');
  });

  it('낮은 직업 레벨에서는 잠긴 설정을 보존하고 엔진에서만 제외한다', () => {
    const config = itemLoadoutOf(['mana', null, 'shield', 'feather']);
    expect(activeItemKeys(config, 1)).toEqual(['mana']);
    expect(activeItemKeys(config, 15)).toEqual(['mana', 'shield']);
    expect(activeItemKeys(config, 30)).toEqual(['mana', 'shield', 'feather']);
    expect(config).toEqual(['mana', null, 'shield', 'feather']);
    const f = create({ encounter: 'warden', diff: '보통', items: activeItemKeys(config, 15), seed: 1 });
    expect(Object.keys(f.items)).toEqual(['mana', 'shield']);
  });

  it('저장/재진입과 구버전 이관에서 null 빈칸 및 순서를 유지한다', () => {
    const data: Record<string, string> = {};
    const kv: KV = { getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
    const s = newSave();
    s.items = [null, 'cleanse', null, 'life'];
    expect(save(s, kv)).toBe(true);
    expect(load(kv).items).toEqual(s.items);
    expect(migrate({ ...s, v: 9 }).items).toEqual(s.items);
    expect(migrate({ ...s, v: 1, items: ['life', 'mana'] }).items).toEqual(['life', 'mana']);
  });
});

describe('편성·캐릭터가 공유하는 단축칸 상태', () => {
  const original = G.save;
  afterEach(() => { G.save = original; });

  it('지정/교환/해제 후 활성 목록과 네 칸 UI 배치를 함께 제공한다', () => {
    G.save = newSave(); G.save.player.level = 30;
    expect(setItemSlot(3, 'life')).toBe('');
    expect(itemsNow()).toEqual({ slots: 4, items: ['mana', 'life'], loadout: ['mana', null, null, 'life'] });
    expect(setItemSlot(0, null)).toBe('');
    expect(itemsNow()).toEqual({ slots: 4, items: ['life'], loadout: [null, null, null, 'life'] });
    expect(G.save.items).toEqual([null, null, null, 'life']);
  });

  it('기존 toggle 호출도 빈칸을 당기거나 잠긴 칸을 지우지 않는다', () => {
    G.save = newSave(); G.save.items = ['mana', 'life', 'shield', 'feather'];
    expect(toggleItem('mana')).toBe('');
    expect(G.save.items).toEqual([null, 'life', 'shield', 'feather']);
    expect(toggleItem('cleanse')).toBe('');
    expect(G.save.items).toEqual(['cleanse', 'life', 'shield', 'feather']);
    expect(setItemSlot(2, null)).not.toBe('');
    expect(G.save.items).toEqual(['cleanse', 'life', 'shield', 'feather']);
  });
});
