import { ITEMS, POTION_CD, type ItemKey } from '../data/items';
import { hexDist } from './board';
import { bark, emit, living, onDebuffEnd } from './core';
import { dangerAt } from './movement';
import type { ActionResult, Fight, Unit } from './types';

export function itemReady(f: Fight, key: ItemKey): ActionResult {
  const it = ITEMS[key];
  const left = f.items[key];
  if (!it || left == null) return { ok: false, reason: '단축칸에 없는 아이템' };
  if (left <= 0) return { ok: false, reason: `${it.name}: 이번 전투에서 다 씀` };
  if (it.kind === 'potion' && f.potCd > 0) return { ok: false, reason: `물약 재사용 대기 ${Math.ceil(f.potCd)}초` };
  return { ok: true };
}

/** 부활 깃털 대상: 쓰러진 탱커 우선, 그다음 가장 최근에 쓰러진 파티원 */
export function reviveTarget(f: Fight): Unit | null {
  const dead = f.party.filter(u => !u.alive && !u.me);
  if (!dead.length) return null;
  const tanks = dead.filter(u => u.role === 'tank');
  const pool = tanks.length ? tanks : dead;
  return pool.reduce((a, b) => ((b.diedAt || 0) > (a.diedAt || 0) ? b : a));
}

/** 쓰러진 파티원을 체력 pct로 일으킴 (부활 깃털·드루이드 환생). 원래 칸이 차 있으면 가까운 빈 칸 */
export function reviveUnit(f: Fight, u: Unit, pct: number): boolean {
  let c = f.cells[u.cell];
  if (c.unit || c.block) {
    const free = f.cells.filter(x => !x.unit && !x.block && !dangerAt(f, x.i));
    const any = free.length ? free : f.cells.filter(x => !x.unit && !x.block);
    if (!any.length) return false;
    c = any.reduce((a, b) => (hexDist(b, f.cells[u.cell]) < hexDist(a, f.cells[u.cell]) ? b : a));
  }
  u.alive = true; u.max = u.base; u.hp = u.max * pct; u.cell = c.i; c.unit = u;
  u.debuffs = []; u.moving = null; u.react = null; u.fleeing = false; u.sulking = false; u.retryAt = f.t + 1;
  emit(f, { type: 'revive', id: u.id });
  emit(f, { type: 'sound', name: 'bell' });
  bark(f, u, '살았다…! 감사', true);
  return true;
}

/** 소비 아이템 사용 (19 2부). cellIdx는 보호 두루마리만 씀 */
export function useItem(f: Fight, key: ItemKey, cellIdx?: number): ActionResult {
  if (f.over) return { ok: false };
  const r = itemReady(f, key);
  if (!r.ok) return r;
  const it = ITEMS[key];
  let note = '';
  if (key === 'mana') {
    if (f.mana >= 99.5) return { ok: false, reason: '마나 가득 참' };
    f.mana = Math.min(100, f.mana + 30);
  } else if (key === 'medit') {
    f.medit = 20;
  } else if (key === 'life') {
    const me = f.me;
    if (me.hp >= me.max - 0.5) return { ok: false, reason: '체력 가득 참' };
    const eff = Math.min(me.max * 0.4, me.max - me.hp);
    me.hp += eff;
    emit(f, { type: 'heal', id: me.id, amt: Math.round(eff), eff: Math.round(eff), crit: false, item: true });
  } else if (key === 'cleanse') {
    let n = 0;
    for (const u of living(f)) {
      const d = u.debuffs.find(x => !x.trap && !x.lock);
      if (!d) continue;
      u.debuffs = u.debuffs.filter(x => x !== d);
      onDebuffEnd(f, u, d, true);
      emit(f, { type: 'dispel', id: u.id, item: true });
      n++;
    }
    if (!n) return { ok: false, reason: '지울 디버프 없음 (함정 디버프는 못 지움)' };
    f.stats.itemDispels = (f.stats.itemDispels || 0) + n;
    note = `${n}명`;
  } else if (key === 'shield') {
    const c = cellIdx == null ? undefined : f.cells[cellIdx];
    const u = c && c.unit;
    if (!u) return { ok: false, reason: '빈 칸' };
    if (!u.alive) return { ok: false, reason: `${u.nick}은(는) 쓰러짐` };
    u.shield = 8;
    note = u.me ? '나' : u.nick;
  } else if (key === 'feather') {
    const u = reviveTarget(f);
    if (!u) return { ok: false, reason: '쓰러진 파티원 없음' };
    if (!reviveUnit(f, u, 0.3)) return { ok: false, reason: '되살릴 빈 칸 없음' };
    note = u.nick;
  }
  f.items[key]!--;
  if (it.kind === 'potion') f.potCd = POTION_CD;
  f.itemLog.push({ key, t: Math.round(f.t * 10) / 10 });
  emit(f, { type: 'item', key, note });
  return { ok: true };
}
