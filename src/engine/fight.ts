import { BOARDS } from '../data/boards';
import { DIFFS, MYTHIC } from '../data/difficulty';
import { ENCOUNTERS, type EncounterKey } from '../data/encounters';
import { gearStats } from '../data/gear';
import { ITEMS } from '../data/items';
import { NICKS, PERS, PERS_NAMES, type PersName } from '../data/personalities';
import { makeCells } from './board';
import { initBoss, bossTick } from './bosses';
import { DT, emit, living } from './core';
import { healerTick } from './healer';
import { adjAllies, centerX, ZONE_PREF, zoneOf } from './movement';
import { rngFrom } from './rng';
import { partyDps, unitTick } from './units';
import type { Cell, Fight, FightConfig, FightResult, Role, RosterEntry, Unit } from './types';

/** 전투 만들기 */
export function create(cfg: FightConfig): Fight {
  const enc = ENCOUNTERS[cfg.encounter];
  const diff = DIFFS[cfg.diff];
  const rng = rngFrom(cfg.seed || 1);
  const gear = gearStats(cfg.gear || 'none');
  const board = cfg.board && BOARDS[cfg.board] && BOARDS[cfg.board].flat().length === BOARDS[enc.board].flat().length ? cfg.board : enc.board;
  const cells = makeCells(BOARDS[board]);
  const rows = BOARDS[board].length;
  const mythic = cfg.diff === '악몽';
  const bossMax = enc.hp * (mythic && !enc.big ? MYTHIC.bossHp : 1);
  const f: Fight = {
    board,
    cfg, enc, diff, rng, gear, cells, rows, mythic,
    t: 0, k: 0, over: null, reason: '',
    dmgMult: diff.dmg,
    bossMax, bossHp: bossMax, mobs: [],
    mana: 100, gcd: 0, gcdBase: 1 / (1 + gear.haste), cast: null, channel: 0, chTick: 0, queued: null,
    cd: { purify: 0, guardian: 0, hymn: 0 },
    g: { p: 0, s: 0 }, symbolUsed: false, symbol: 0,
    skills: [], tels: [], zones: [], events: [], phase: 1, phaseName: '', invuln: false,
    enraged: false, dpsAcc: 0, rats: [],
    items: {}, potCd: 0, medit: 0, itemLog: [],
    stats: { healed: 0, overheal: 0, deaths: 0, minMana: 100, dispels: 0, dispellable: 0, trapPops: 0, queueLost: 0, casts: {}, taps: 0, missTaps: 0, emptyTaps: 0, cancels: 0, manaFails: 0, hymnBroken: 0 },
    nextId: 1,
    party: [],
    me: null as unknown as Unit, // makeParty에서 채움
  };
  for (const k of (cfg.items || []).slice(0, 4)) if (ITEMS[k]) f.items[k] = ITEMS[k].uses;
  if (cfg.carry) { f.mana = cfg.carry.mana; f.stats.minMana = f.mana; f.g = { ...cfg.carry.g }; }
  makeParty(f, cfg.party);
  initBoss(f);
  return f;
}

/** 공개모집 파티 뽑기 (시드 고정) */
export function rollParty(encKey: EncounterKey, seed: number): RosterEntry[] {
  const enc = ENCOUNTERS[encKey];
  const rng = rngFrom(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const nicks = NICKS.slice();
  for (let i = nicks.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [nicks[i], nicks[j]] = [nicks[j], nicks[i]]; }
  const low = !!enc.lowLevel; // 04 6-F: 저레벨 던전은 탱커 ★ 성격만, ★★★ 파티당 최대 1명
  let hard = 0;
  const choose = (role: RosterEntry['role']): PersName => {
    let pool = PERS_NAMES.filter(p => !(role === 'tank' && 'noTank' in PERS[p]));
    if (low && role === 'tank') pool = pool.filter(p => PERS[p].star === 1);
    if (low && hard >= 1) pool = pool.filter(p => PERS[p].star < 3);
    const p = pick(pool);
    if (PERS[p].star === 3) hard++;
    return p;
  };
  const list: RosterEntry[] = [];
  for (let i = 0; i < enc.comp.tank; i++) list.push({ role: 'tank', pers: choose('tank'), nick: nicks.pop()! });
  for (let i = 0; i < enc.comp.melee; i++) list.push({ role: 'melee', pers: choose('melee'), nick: nicks.pop()! });
  for (let i = 0; i < enc.comp.ranged; i++) list.push({ role: 'ranged', pers: choose('ranged'), nick: nicks.pop()! });
  return list;
}

function makeParty(f: Fight, roster?: RosterEntry[]): void {
  const mult = f.mythic ? MYTHIC.party : 1;
  const units: Unit[] = [];
  const add = (role: Role, pers: PersName | null, nick: string): Unit => {
    const base = (role === 'tank' ? 1000 : role === 'healer' ? 550 : 600) * mult;
    const dps = (role === 'tank' ? 4 : role === 'healer' ? 0 : 10) * mult;
    const u: Unit = {
      id: f.nextId++, role, pers, p: pers ? PERS[pers] : {}, nick, base, max: base, hp: base, dps, alive: true,
      cell: -1, home: -1, hot: 0, hotTick: 0, echo: [], guardian: 0, shield: 0, debuffs: [], moving: null, react: null,
      retryAt: 0, mistakeUntil: 0, wrongUntil: 0, fleeing: false, sulking: false, lastHeal: 0, thanks: 0, flash: 0,
      barkAt: -10, ignoreZone: 0, homeAt: null, diedAt: 0, me: role === 'healer',
    };
    units.push(u);
    return u;
  };
  const roles = roster || rollParty(f.enc.key, f.cfg.seed || 1);
  roles.forEach(r => add(r.role, r.pers, r.nick));
  add('healer', null, '나');
  f.party = units;
  f.me = units[units.length - 1];
  // 배치 (04 5-2): 탱커 → 나 → 근접 → 원거리
  const cx = centerX(f);
  const order = [...units.filter(u => u.role === 'tank'), f.me, ...units.filter(u => u.role === 'melee'), ...units.filter(u => u.role === 'ranged')];
  for (const u of order) {
    let best: Cell | null = null, bs = -Infinity;
    for (const c of f.cells) {
      if (c.unit) continue;
      let s = ZONE_PREF[u.role][zoneOf(f, c.row)];
      if (u.role === 'tank' || u.role === 'healer') s -= Math.abs(c.px - cx) * 6;
      if (u.role === 'tank') s -= c.row * 30;
      s += (u.p.dist || 0) * adjAllies(f, c, u) * 8;
      if (u.p.dist === -1) s += Math.abs(c.px - cx) * 4;
      s += f.rng() * 3;
      if (s > bs) { bs = s; best = c; }
    }
    best!.unit = u; u.cell = best!.i; u.home = best!.i;
  }
}

/** 한 틱 (0.05초) */
export function step(f: Fight): void {
  if (f.over) return;
  f.t += DT; f.k++;
  healerTick(f);
  for (const u of f.party) unitTick(f, u);
  bossTick(f);
  if (!f.invuln) {
    const d = partyDps(f) * DT;
    if (f.mobs.length) hitMobs(f, d); else f.bossHp -= d;
    f.dpsAcc += d;
  }
  if (f.k % 20 === 0 && f.dpsAcc > 0) { emit(f, { type: 'dps', amt: Math.round(f.dpsAcc) }); f.dpsAcc = 0; }
  const live = living(f);
  if (f.bossHp <= 0) { f.bossHp = 0; end(f, 'win', f.mobs.length ? '모두 쓰러뜨렸어요' : '보스를 쓰러뜨렸어요'); }
  else if (!f.me.alive) end(f, 'lose', '힐러가 쓰러졌어요');
  else if (!live.some(u => u.role === 'tank')) end(f, 'lose', '탱커가 모두 쓰러졌어요');
  else if (live.length <= f.party.length * 0.3) end(f, 'lose', '파티원 70%가 쓰러졌어요');
}

/** 잡몹 구간: 파티 딜은 잡을 차례인 잡몹에게, 남는 딜은 다음 잡몹에게 (23 2장) */
function hitMobs(f: Fight, d: number): void {
  let left = d;
  for (const m of f.mobs) {
    if (!m.alive) continue;
    const x = Math.min(m.hp, left);
    m.hp -= x; left -= x;
    if (m.hp <= 1e-9) {
      m.hp = 0; m.alive = false;
      f.tels = f.tels.filter(t => t.skill.mob !== m.id); // 시전 중이던 기술도 끊김
      emit(f, { type: 'mobDown', id: m.id, name: m.name });
    }
    if (left <= 1e-9) break;
  }
  f.bossHp = f.mobs.reduce((s, m) => s + m.hp, 0);
}

function end(f: Fight, result: FightResult, reason: string): void {
  f.over = result; f.reason = reason;
  emit(f, { type: 'over', result });
}
