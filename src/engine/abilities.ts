/**
 * 파티원 특수 능력 (17 3~7장). 파티원이 알아서 씀: 0.2초마다 상태를 보고(체력·보스 30%·적 등장 …),
 * 보스 기술 예고·시전 시작·죽을 피해 순간에는 바로 판단한다. 능력 데이터는 data/abilities.ts.
 * 능력을 가진 파티원이 없으면(f.abOn = false) 이 파일의 코드는 하나도 돌지 않는다 (프로토타입과 같은 결과).
 */
import { ABILITIES, starFx, type AbilityDef, type Fx, type Trig } from '../data/abilities';
import { hexDist } from './board';
import { cellOf, damage, damageMob, DT, emit, living, onDebuffEnd } from './core';
import { moveTo, pickCell } from './movement';
import type { AbState, BossSkill, Fight, Mod, ModKind, Telegraph, Unit } from './types';

const DEF = (u: Unit): AbilityDef => ABILITIES[u.ab!.key];
const pos = (u: Unit) => (u.moving ? u.moving.to : u.cell);
const pct = (u: Unit) => u.hp / u.max;

/** 파티원에 능력 붙이기 (makeParty). 덜렁이는 회복 능력을 쓰는 체력이 판마다 무작위 (17 6-1) */
export function giveAb(f: Fight, u: Unit, key: string, star = 0): void {
  const a = ABILITIES[key];
  if (!a || a.cls !== u.cls) return;
  const s: AbState = { key, star: Math.max(0, Math.min(5, star | 0)), ready: 0, uses: 0, fired: [], hist: [], lastCounter: -9 };
  if (u.pers === '덜렁이' && a.kind === 'heal') s.odd = 0.15 + f.rng() * 0.55;
  u.ab = s;
  f.abOn = true;
}

// ---------- 효과 (mods) ----------
export const hasMod = (u: Unit, k: ModKind) => u.mods.some(m => m.k === k);

/** 같은 출처·같은 종류는 새것으로 바꿈 (20인에서 같은 효과는 한 사람에 중첩 안 됨, 17 7장) */
export function addMod(u: Unit, m: Mod): void {
  const old = u.mods.find(x => x.k === m.k && x.src === m.src);
  if (old) { if (old.k === 'hp') endHp(u, old); u.mods = u.mods.filter(x => x !== old); }
  u.mods.push(m);
}
function endHp(u: Unit, m: Mod): void {
  u.max -= m.v;
  if (u.max < u.base && !u.debuffs.some(d => d.name === '썩은 숨결')) u.max = u.base;
  u.hp = Math.min(u.hp, u.max);
}

/** 받는 피해에 능력 효과 적용. -1 = 무시 (피해 없음) */
export function dmgMods(f: Fight, u: Unit, amt: number, magic: boolean): number {
  if (f.ab.weakUntil > f.t) amt *= 1 - f.ab.weak;
  if (!u.mods.length) return amt;
  let share: Mod | null = null;
  for (const m of u.mods) {
    if (m.until <= f.t) continue;
    switch (m.k) {
      case 'imm': return -1;
      case 'spell': if (magic) { m.until = 0; return -1; } break;
      case 'cut': amt *= 1 - m.v; break;
      case 'mcut': if (magic) amt *= 1 - m.v; break;
      case 'vuln': amt *= 1 + m.v; break;
      case 'share': share = m; break;
    }
  }
  for (const m of u.mods) {
    if (m.k !== 'absorb' || m.until <= f.t || amt <= 0) continue;
    const take = Math.min(m.v, amt);
    m.v -= take; amt -= take;
    if (m.v <= 1e-9) m.until = 0;
  }
  if (share && amt > 0) {
    const by = f.party.find(x => x.id === share!.by);
    if (by && by.alive && by !== u) { const part = amt * share.v; amt -= part; damage(f, by, part / f.dmgMult, magic); }
  }
  return amt;
}

/** 마법 디버프 막기 (주문 반사·그림자 망토) */
export function blocksDebuff(f: Fight, u: Unit, type: string): boolean {
  if (type !== '마법') return false;
  const m = u.mods.find(x => x.k === 'spell' && x.until > f.t);
  if (!m) return false;
  m.until = 0;
  return true;
}

/** 받는 치유 배율 (광란 +30%, 얼음 방패 중 0) */
export function healMods(f: Fight, u: Unit): number {
  let x = 1;
  for (const m of u.mods) {
    if (m.until <= f.t) continue;
    if (m.k === 'noheal') return 0;
    if (m.k === 'heal') x *= 1 + m.v;
  }
  return x;
}

/** 딜 배율 (멈춤·딜 0이면 0) */
export function dpsMods(u: Unit): number {
  let x = 1;
  for (const m of u.mods) {
    if (m.k === 'nodps' || m.k === 'stop') return 0;
    if (m.k === 'dps') x *= 1 + m.v;
  }
  return x;
}
export function moveMods(u: Unit): number { let x = 1; for (const m of u.mods) if (m.k === 'move') x *= 1 - m.v; return x; }
export function reactMods(u: Unit): number { let x = 1; for (const m of u.mods) if (m.k === 'react') x *= 1 - m.v; return x; }
export function dodgeMods(u: Unit): number { let x = 0; for (const m of u.mods) if (m.k === 'dodge') x += m.v; return x; }

/** 파티원 능력 회복 (연두색 숫자). 내 힐 통계에는 안 넣음 */
export function allyHeal(f: Fight, u: Unit, amt: number, by: Unit = u): number {
  if (!u.alive || amt <= 0) return 0;
  amt *= healMods(f, u);
  const eff = Math.min(amt, u.max - u.hp);
  if (eff <= 0) return 0;
  u.hp += eff;
  f.stats.abHeal = (f.stats.abHeal || 0) + eff;
  if (by.ab) by.ab.healed = (by.ab.healed || 0) + eff;
  emit(f, { type: 'aheal', id: u.id, amt: Math.round(eff) });
  return eff;
}

// ---------- 매 틱 ----------
/** 효과 시간, 나눠 회복, 칼날폭풍, 0.2초마다 능력 판단 */
export function abTick(f: Fight): void {
  for (const u of f.party) {
    if (!u.mods.length) continue;
    for (const m of u.mods) {
      if (m.k === 'ahot' && u.alive) allyHeal(f, u, Math.min(m.v * DT, Math.max(0, m.v * (m.until - f.t + DT))));
      if (m.until <= f.t && m.k === 'hp') endHp(u, m);
    }
    u.mods = u.mods.filter(m => m.until > f.t);
  }
  const dot = f.ab.addDot;
  if (dot) {
    if (dot.until <= f.t) f.ab.addDot = null;
    else {
      const by = f.party.find(x => x.id === dot.by);
      for (const m of f.mobs) if (m.alive && !m.boss) { const x = Math.min(m.hp, m.max * dot.rate * DT); if (by) by.dealt += x; damageMob(f, m, x); }
    }
  }
  if (f.k % 4 !== 0) return;
  const sec = f.k % 20 === 0;
  for (const u of f.party) {
    if (!u.ab || !u.alive) continue;
    if (sec && DEF(u).fx.e === 'rewind') { u.ab.hist.push(u.hp); if (u.ab.hist.length > 6) u.ab.hist.shift(); }
    poll(f, u);
  }
}

/** 상시 능력 효과를 새로 걸고, 상태로 판단하는 쓰는 때를 봄 */
function poll(f: Fight, u: Unit): void {
  const a = DEF(u), s = u.ab!;
  if (a.cd === 0 && !a.each) { passive(f, u, a); return; }
  if (hasMod(u, 'stop')) return;
  // 덜렁이: 가끔 엉뚱한 때 씀 (17 6-3)
  if (u.pers === '덜렁이' && a.cd > 0 && f.t >= s.ready && f.t > 3 && f.rng() < 0.004) { use(f, u, a, {}); return; }
  a.trig.forEach((tr, i) => {
    if (!u.ab || !ready(f, u, a, i)) return;
    const hit = check(f, u, a, tr);
    if (!hit) return;
    if (a.each) s.fired.push(i);
    use(f, u, a, { target: hit === true ? undefined : hit });
  });
}

function ready(f: Fight, u: Unit, a: AbilityDef, i: number): boolean {
  const s = u.ab!;
  if (!u.alive) return false;
  if (a.each) return !s.fired.includes(i);
  if (a.cd < 0) return s.uses === 0;
  return f.t >= s.ready;
}

/** 고집불통: 체력 70% 이상이면 방어 능력 안 씀 (17 6-3) */
const stubbornSkip = (u: Unit, a: AbilityDef) => u.pers === '고집불통' && a.kind === 'def' && pct(u) >= 0.7;

/** 상태 쓰는 때. 맞으면 true 또는 대상 아군 */
function check(f: Fight, u: Unit, a: AbilityDef, tr: Trig): Unit | true | null {
  if ('hpBelow' in tr && tr.hpBelow != null && pct(u) >= tr.hpBelow) return null;
  switch (tr.t) {
    case 'low': {
      if (tr.noZone && (u.moving || f.zones.some(z => z.cells.has(u.cell)) || f.tels.some(t => t.kind === 'zone' && t.cells.has(u.cell)))) return null;
      let thr = tr.hp + starFx(a, u.ab!.star).early;
      if (a.kind === 'heal') {
        if (u.ab!.odd != null) thr = u.ab!.odd;
        else if (u.p.flee) thr = Math.max(thr, u.p.flee); // 겁쟁이: 도망치면서
        if (u.p.attention && f.t > 8 && f.t - u.lastHeal > 8 && pct(u) < 0.7) return true; // 관심종자
      }
      return pct(u) < thr ? true : null;
    }
    case 'start': return f.t >= 0.5 && f.t < 6 ? true : null;
    case 'boss30': return !f.invuln && f.bossHp > 0 && f.bossHp <= f.bossMax * 0.3 ? true : null;
    case 'ready': return f.t >= 1 && f.bossHp > 0 ? true : null;
    case 'adds': return addsN(f) >= tr.n ? true : null;
    case 'addsHit': return addsHit(f) ? true : null;
    case 'allyLow': {
      const c = cellOf(f, u);
      const list = living(f).filter(v => v !== u && pct(v) < tr.hp && hexDist(cellOf(f, v), c) <= tr.r && !(tr.nonTank && v.role === 'tank'));
      return pickAlly(u, list);
    }
    case 'allyDebuff': {
      const c = cellOf(f, u);
      const list = living(f).filter(v => hexDist(cellOf(f, v), c) <= tr.r && v.debuffs.some(cleanable));
      return pickAlly(u, list);
    }
    default: return null;
  }
}
const cleanable = (d: { type: string; trap?: boolean }) => (d.type === '독' || d.type === '질병') && !d.trap;

/** 남에게 쓰는 능력의 대상 (17 6-1): 기본 = 가장 위험한 아군, 신중파 = 탱커 먼저 */
function pickAlly(u: Unit, list: Unit[]): Unit | null {
  if (!list.length) return null;
  if (u.pers === '신중파') { const tk = list.filter(v => v.role === 'tank'); if (tk.length) list = tk; }
  return list.reduce((a, b) => (pct(b) < pct(a) ? b : a));
}

function addsN(f: Fight): number { return f.mobs.filter(m => m.alive && !m.boss).length; }
/** 보스 아닌 적이 탱커 아닌 사람을 때리는 중 (쥐떼 포함) */
function addsHit(f: Fight): boolean {
  if (f.ab.tauntUntil > f.t) return false;
  if (f.rats.some(id => { const v = f.party.find(x => x.id === id); return v && v.alive && v.role !== 'tank'; })) return true;
  return f.skills.some(s => s.other && f.mobs.some(m => m.id === s.mob && m.alive && !((m.stun || 0) > f.t)));
}

/** 상시 능력: 0.2초마다 짧게 다시 걸어 둠 */
function passive(f: Fight, u: Unit, a: AbilityDef): void {
  const fx = a.fx, s = u.ab!, e = starFx(a, s.star).eff, until = f.t + 0.25, c = cellOf(f, u);
  switch (fx.e) {
    case 'auraMagic': for (const v of living(f)) if (v !== u && hexDist(cellOf(f, v), c) === 1) addMod(v, { k: 'mcut', v: fx.v * e, until, src: a.name }); break;
    case 'auraDps': for (const v of living(f)) if (v !== u && v.role === 'ranged' && hexDist(cellOf(f, v), c) === 1) addMod(v, { k: 'dps', v: fx.v * e, until, src: a.name }); break;
    case 'mark':
      if (!f.invuln && f.bossHp <= f.bossMax * 0.3) {
        addMod(u, { k: 'dps', v: fx.v * e, until, src: a.key });
        for (const v of living(f)) addMod(v, { k: 'dps', v: fx.party, until, src: '죽음의 표적' });
      }
      break;
    case 'wish':
      if (pct(u) < 0.3) { addMod(u, { k: 'dps', v: fx.v * e, until, src: a.key }); addMod(u, { k: 'vuln', v: fx.vuln, until, src: a.key }); }
      break;
    case 'pet': addMod(u, { k: 'dps', v: fx.v * e, until, src: a.key }); addMod(u, { k: 'mcut', v: fx.cut * e, until, src: a.key }); break;
  }
}

// ---------- 순간 판단 ----------
/** 보스 기술 예고가 막 떴을 때 (bossTick) */
export function abOnTel(f: Fight, tel: Telegraph): void {
  for (const u of f.party) {
    if (!u.ab || !u.alive || hasMod(u, 'stop')) continue;
    const a = DEF(u);
    if (a.cd === 0 && !a.each) continue;
    a.trig.forEach((tr, i) => {
      if (!ready(f, u, a, i) || !f.tels.includes(tel)) return;
      const hit = telMatch(f, u, a, tr, tel);
      if (!hit) return;
      if (a.each) u.ab!.fired.push(i);
      use(f, u, a, { tel, target: hit === true ? undefined : hit });
    });
  }
}

function telMatch(f: Fight, u: Unit, a: AbilityDef, tr: Trig, tel: Telegraph): Unit | true | null {
  if ('hpBelow' in tr && tr.hpBelow != null && pct(u) >= tr.hpBelow) return null;
  const k = tel.kind, mine = tel.units.includes(u.id), point = k !== 'aoe' && k !== 'zone';
  if (stubbornSkip(u, a) && tr.t !== 'low') return null;
  switch (tr.t) {
    case 'buster': return k === 'buster' && mine ? true : null;
    case 'targeted': return point && mine ? true : null;
    case 'aoe': return k === 'aoe' ? true : null;
    case 'zone': return k === 'zone' && tel.cells.has(pos(u)) ? true : null;
    case 'zoneAny': return k === 'zone' ? true : null;
    case 'zone3': {
      if (k !== 'zone') return null;
      const inside = living(f).filter(v => tel.cells.has(pos(v)));
      const c = cellOf(f, u);
      return inside.length >= 3 && inside.some(v => hexDist(f.cells[pos(v)], c) <= 1) ? true : null;
    }
    case 'zoneNear': {
      if (k !== 'zone') return null;
      const c = cellOf(f, u);
      return living(f).some(v => tel.cells.has(pos(v)) && hexDist(f.cells[pos(v)], c) <= 1) ? true : null;
    }
    case 'cast': return a.fx.e === 'delay' && tel.skill.cut ? true : null;
    case 'allyTargeted': {
      if (!point) return null;
      const c = cellOf(f, u);
      const list = tel.units.map(id => f.party.find(x => x.id === id)).filter((v): v is Unit => !!v && v !== u && v.alive && hexDist(cellOf(f, v), c) <= tr.r && (tr.hp == null || pct(v) < tr.hp));
      return list[0] || null;
    }
    default: return null;
  }
}

/** 끊기 (17 7장): 끊기 가능 기술의 시전 시작, 저격은 버스터·광폭화가 아닌 광역·장판. 준비된 한 사람만 시도. 끊으면 true */
export function abCut(f: Fight, s: BossSkill): boolean {
  const snipeable = (s.kind === 'aoe' || s.kind === 'zone') && s.key !== 'enrage';
  if (!s.cut && !snipeable) return false;
  for (const u of f.party) {
    if (!u.ab || !u.alive || hasMod(u, 'stop')) continue;
    const a = DEF(u);
    if (a.fx.e !== 'interrupt' || !ready(f, u, a, 0)) continue;
    const any = a.trig.some(t => t.t === 'castAny');
    if (any ? !snipeable : !s.cut) continue;
    const st = starFx(a, u.ab.star);
    const p = Math.min(1, a.fx.v * st.eff + (u.ab.star >= 5 ? 0.15 : 0));
    const ok = p >= 1 || f.rng() < p;
    use(f, u, a, {});
    emit(f, { type: 'msg', text: `${u.nick} ${a.name}: ${s.name || '기술'} ${ok ? '끊음' : '끊기 실패'}` });
    return ok; // 한 기술에 한 사람만 시도 (실패하면 그대로 맞음)
  }
  return false;
}

/** 죽을 피해 (얼음 방패). 막으면 true */
export function abLethal(f: Fight, u: Unit): boolean {
  const a = DEF(u);
  if (!a.trig.some(t => t.t === 'lethal') || !ready(f, u, a, 0)) return false;
  use(f, u, a, {});
  return true;
}

/** 겁먹고 도망가려는 순간 (광폭화). 안 도망가면 true */
export function abFear(f: Fight, u: Unit): boolean {
  if (u.mods.some(m => m.k === 'nofear')) return true;
  if (!u.ab) return false;
  const a = DEF(u);
  if (!a.trig.some(t => t.t === 'fear') || !ready(f, u, a, 0)) return false;
  use(f, u, a, {});
  return true;
}

/** 이동을 마친 뒤 (연발 사격) */
export function abMoved(f: Fight, u: Unit): void {
  if (!u.ab || !u.alive) return;
  const a = DEF(u);
  if (a.trig.some(t => t.t === 'moved') && ready(f, u, a, 0) && f.bossHp > 0) use(f, u, a, {});
}

/** 피해를 받음 (거합 반격: 1초에 한 번까지) */
export function abHurt(f: Fight, u: Unit): void {
  const a = DEF(u), s = u.ab!;
  if (a.fx.e !== 'counter' || f.t - s.lastCounter < 1 || f.bossHp <= 0) return;
  s.lastCounter = f.t;
  if (f.rng() < a.fx.v * starFx(a, s.star).eff) { u.acc += u.dps; s.uses++; }
}

// ---------- 사용 ----------
interface Ctx { tel?: Telegraph; target?: Unit }

function use(f: Fight, u: Unit, a: AbilityDef, ctx: Ctx): void {
  const s = u.ab!, st = starFx(a, s.star);
  s.uses++;
  if (a.cd > 0) s.ready = f.t + a.cd * st.cd;
  f.stats.abUses = (f.stats.abUses || 0) + 1;
  emit(f, { type: 'ability', id: u.id, name: a.name });
  apply(f, u, a, a.fx, st.eff, ctx);
}

function apply(f: Fight, u: Unit, a: AbilityDef, fx: Fx, e: number, ctx: Ctx): void {
  const s5 = u.ab!.star >= 5;
  const sec = (x: number) => f.t + x * (s5 && a.kind === 'atk' ? 1.5 : 1);
  const R = (r: number) => r + (s5 && a.kind === 'sup' ? 1 : 0);
  const near = (r: number, self: boolean) => { const c = cellOf(f, u); return living(f).filter(v => (self || v !== u) && hexDist(cellOf(f, v), c) <= r); };
  const src = a.key;
  /** 🛡 ★5: 옆 아군 1명(가장 다친)에게도 절반 */
  const half = (v: number, until: number) => {
    if (!s5 || a.kind !== 'def') return;
    const n = near(1, false);
    if (n.length) addMod(n.reduce((p, q) => (pct(q) < pct(p) ? q : p)), { k: 'cut', v: v / 2, until, src: `${src}½` });
  };
  switch (fx.e) {
    case 'cut': {
      const until = fx.hit && ctx.tel ? ctx.tel.impact + 0.1 : f.t + (fx.sec ?? 2);
      const v = Math.min(0.9, fx.v * e);
      addMod(u, { k: fx.magic ? 'mcut' : 'cut', v, until, src });
      if (fx.nodps) addMod(u, { k: 'nodps', v: 1, until, src });
      half(v, until);
      break;
    }
    case 'immune': {
      const until = f.t + fx.sec;
      addMod(u, { k: 'imm', v: 1, until, src }); addMod(u, { k: 'nodps', v: 1, until, src });
      half(1, until);
      break;
    }
    case 'vanish': {
      untarget(f, u);
      const until = f.t + fx.sec;
      if (fx.cut) addMod(u, { k: 'cut', v: Math.min(0.9, fx.cut * e), until, src });
      else { addMod(u, { k: 'imm', v: 1, until, src }); addMod(u, { k: 'nodps', v: 1, until, src }); }
      break;
    }
    case 'untarget': untarget(f, u); break;
    case 'selfHeal': {
      const amt = u.max * Math.min(fx.v * e, fx.v * 1.25);
      const over = fx.stop || fx.over || 0;
      if (fx.stop) addMod(u, { k: 'stop', v: 1, until: f.t + fx.stop, src });
      if (over) addMod(u, { k: 'ahot', v: amt / over, until: f.t + over, src });
      else allyHeal(f, u, amt);
      break;
    }
    case 'lastStand': {
      const bonus = u.max * Math.min(fx.v * e, fx.v * 1.25);
      u.max += bonus;
      addMod(u, { k: 'hp', v: bonus, until: f.t + fx.sec, src });
      allyHeal(f, u, bonus);
      break;
    }
    case 'rewind': {
      const back = u.ab!.hist[0] ?? u.hp;
      allyHeal(f, u, Math.min(back - u.hp, u.max * Math.min(fx.v * e, fx.v * 1.25)));
      break;
    }
    case 'absorb': addMod(u, { k: 'absorb', v: u.max * fx.v * e, until: f.t + fx.sec, src }); break;
    case 'spell': addMod(u, { k: 'spell', v: 1, until: ctx.tel ? ctx.tel.impact + 0.3 : f.t + 5, src }); break;
    case 'iceBlock': {
      const until = f.t + fx.sec;
      for (const k of ['imm', 'nodps', 'noheal', 'stop'] as const) addMod(u, { k, v: 1, until, src });
      emit(f, { type: 'msg', text: `${u.nick} ${a.name}: 죽을 피해를 막음` });
      break;
    }
    case 'dps': {
      const until = sec(fx.sec);
      addMod(u, { k: 'dps', v: fx.v * e, until, src });
      if (fx.vuln) addMod(u, { k: 'vuln', v: fx.vuln, until, src });
      break;
    }
    case 'allyDps': for (const v of near(R(fx.r), !!fx.self)) addMod(v, { k: 'dps', v: fx.v * e, until: sec(fx.sec), src: a.name }); break;
    case 'weaken': f.ab.weak = Math.max(f.ab.weakUntil > f.t ? f.ab.weak : 0, fx.v * e); f.ab.weakUntil = f.t + fx.sec; break;
    case 'taunt':
      f.ab.taunt = u.id; f.ab.tauntUntil = f.t + fx.sec;
      if (f.rats.length) f.rats = f.rats.map(() => u.id);
      if (fx.vuln) addMod(u, { k: 'vuln', v: fx.vuln, until: f.t + fx.sec, src });
      break;
    case 'handoff': {
      const tk = living(f).find(v => v.role === 'tank');
      if (!tk) break;
      f.ab.taunt = tk.id; f.ab.tauntUntil = f.t + fx.sec;
      if (f.rats.length) f.rats = f.rats.map(() => tk.id);
      break;
    }
    case 'stunAdd': {
      const m = f.mobs.find(x => x.alive && !x.boss && !((x.stun || 0) > f.t) && f.skills.some(s => s.mob === x.id && s.other))
        || f.mobs.find(x => x.alive && !x.boss && !((x.stun || 0) > f.t));
      if (m) { m.stun = f.t + fx.sec * e; f.tels = f.tels.filter(t => t.skill.mob !== m.id); break; }
      const i = f.rats.findIndex(id => f.party.find(x => x.id === id)?.role !== 'tank');
      if (i >= 0) f.rats.splice(i, 1);
      break;
    }
    case 'stunAdds':
      for (const m of f.mobs) if (m.alive && !m.boss) { m.stun = f.t + fx.sec * e; f.tels = f.tels.filter(t => t.skill.mob !== m.id); }
      break;
    case 'hitAdds':
      if (fx.sec) f.ab.addDot = { rate: (fx.v * e) / fx.sec, until: sec(fx.sec), by: u.id };
      else for (const m of f.mobs) if (m.alive && !m.boss) { const x = Math.min(m.hp, m.max * fx.v * e); u.dealt += x; damageMob(f, m, x); }
      break;
    case 'delay': if (ctx.tel) ctx.tel.impact += fx.sec * e; break;
    case 'dodgeNow': {
      const tel = ctx.tel;
      if (!tel || !tel.cells.has(pos(u)) || u.moving) break;
      const c = pickCell(f, u, { safe: true, extra: tel.cells });
      if (!c) break;
      if (fx.keepAim) addMod(u, { k: 'aim', v: 1, until: f.t + 1, src });
      moveTo(f, u, c);
      u.moving!.left = u.moving!.total = 0.1;
      u.react = null;
      break;
    }
    case 'smoke': for (const v of near(R(fx.r), true)) addMod(v, { k: 'dodge', v: 1, until: f.t + fx.sec, src: a.name }); break;
    case 'fast': addMod(u, { k: 'move', v: Math.min(0.8, fx.v * e), until: f.t + fx.sec, src }); break;
    case 'react': for (const v of near(R(fx.r), true)) addMod(v, { k: 'react', v: Math.min(0.6, fx.v * e), until: f.t + fx.sec, src: a.name }); break;
    case 'cleanse': {
      const v = ctx.target, d = v && v.debuffs.find(cleanable);
      if (!v || !d) break;
      v.debuffs = v.debuffs.filter(x => x !== d);
      onDebuffEnd(f, v, d, true);
      emit(f, { type: 'dispel', id: v.id, item: true });
      break;
    }
    case 'share': if (ctx.target) addMod(ctx.target, { k: 'share', v: Math.min(0.6, fx.v * e), until: f.t + fx.sec, src, by: u.id }); break;
    case 'protect': if (ctx.target) ctx.target.immune = Math.max(ctx.target.immune, fx.sec * e); break;
    case 'intercept': {
      const tel = ctx.tel, v = ctx.target;
      if (tel && v) tel.units = tel.units.map(id => (id === v.id ? u.id : id));
      break;
    }
    case 'guardAlly': if (ctx.target) addMod(ctx.target, { k: 'cut', v: Math.min(0.9, fx.v * e), until: f.t + fx.sec, src }); break;
    case 'healTaken': addMod(u, { k: 'heal', v: fx.v * e, until: f.t + fx.sec, src }); break;
    case 'maxHp':
      for (const v of near(R(fx.r), true)) { const b = v.max * fx.v * e; v.max += b; addMod(v, { k: 'hp', v: b, until: f.t + fx.sec, src: a.name }); }
      break;
    case 'nofear': addMod(u, { k: 'nofear', v: 1, until: f.t + fx.sec * e, src }); break;
    case 'aimMax': u.aim = 25; break;
    case 'unzone':
      if (ctx.tel) { f.tels = f.tels.filter(t => t !== ctx.tel); emit(f, { type: 'msg', text: `${u.nick} ${a.name}: ${ctx.tel.skill.name || '장판'} 없앰` }); }
      break;
    default: break; // interrupt(abCut), 상시 능력(passive)
  }
}

/** 지정 공격 대상에서 빠짐 (진행 중인 예고에서 이 사람을 뺌) */
function untarget(f: Fight, u: Unit): void {
  for (const t of f.tels) if (t.units.includes(u.id) && t.kind !== 'aoe' && t.kind !== 'zone') t.units = t.units.filter(id => id !== u.id);
}
