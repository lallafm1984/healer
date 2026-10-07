import { BOARDS } from '../data/boards';
import { CLASSES, RECRUIT_CLASSES, sameClassMax, type ClassKey } from '../data/classes';
import { DIFFS, MYTHIC } from '../data/difficulty';
import { ENCOUNTERS, type EncounterKey } from '../data/encounters';
import { gearStats } from '../data/gear';
import { ITEMS } from '../data/items';
import { NICKS, PERS, PERS_NAMES, type PersName } from '../data/personalities';
import { lvPower } from '../data/progression';
import { BULWARK, TRAIT_CHANCE, TRAITS, type TraitKey } from '../data/traits';
import { makeCells } from './board';
import { aggroTarget, initBoss, bossTick } from './bosses';
import { bark, DT, emit, living } from './core';
import { healerTick, knowsPassive } from './healer';
import { adjAllies, centerX, ZONE_PREF, zoneOf } from './movement';
import { rngFrom } from './rng';
import { partyDps, unitTick } from './units';
import type { Cell, Fight, FightConfig, FightResult, Role, RosterEntry, Unit } from './types';

/** 전투 만들기 */
export function create(cfg: FightConfig): Fight {
  const enc = ENCOUNTERS[cfg.encounter];
  const diff = DIFFS[cfg.diff];
  const rng = rngFrom(cfg.seed || 1);
  const gear = cfg.gearStats ? { ...cfg.gearStats } : gearStats(cfg.gear || 'none');
  const board = cfg.board && BOARDS[cfg.board] && BOARDS[cfg.board].flat().length === BOARDS[enc.board].flat().length ? cfg.board : enc.board;
  const cells = makeCells(BOARDS[board]);
  const rows = BOARDS[board].length;
  const mythic = cfg.diff === '악몽';
  // 레벨 배율 (07 4장): 단계가 같으면 비율은 그대로이고 숫자만 커짐. 단계보다 높은 만큼 힐러가 세짐
  const stageLv = cfg.stageLv ?? 1;
  const scale = lvPower(stageLv);
  const power = lvPower(Math.max(cfg.heroLv ?? stageLv, stageLv));
  const bossMax = enc.hp * (mythic && !enc.big ? MYTHIC.bossHp : 1) * scale;
  const f: Fight = {
    board,
    cfg, enc, diff, rng, gear, cells, rows, mythic,
    t: 0, k: 0, over: null, reason: '',
    dmgMult: diff.dmg * scale, scale, power,
    bossMax, bossHp: bossMax, mobs: [],
    mana: 100, gcd: 0, gcdBase: 1 / (1 + gear.haste), cast: null, channel: 0, chTick: 0, queued: null,
    cd: { purify: 0, guardian: 0, hymn: 0 },
    g: { p: 0, s: 0 }, symbolUsed: false, symbol: 0, level: cfg.level ?? 100,
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
  if (!knowsPassive(f, 'words')) f.g = { p: 0, s: 0 };
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

/**
 * 공개모집 (17 2-1): rollParty로 닉네임·성격을 뽑고, 역할마다 Lv 1 직업을 붙인다.
 * 같은 직업은 5인 1명 · 10인 2명 · 20인 3명까지 (자리가 모자라면 가장 적은 직업부터 더 넣음).
 * 직업은 따로 굴린 난수로 정해서 rollParty 결과(프로토타입과 같음)는 그대로 둔다.
 */
export function recruitParty(encKey: EncounterKey, seed: number): RosterEntry[] {
  const list = rollParty(encKey, seed);
  const rng = rngFrom(Math.imul(seed, 0x9e3779b1) ^ 0x85ebca6b);
  const max = sameClassMax(list.length + 1);
  const count: Partial<Record<ClassKey, number>> = {};
  for (const m of list) {
    const pool = RECRUIT_CLASSES.filter(k => CLASSES[k].role === m.role);
    let ok = pool.filter(k => (count[k] || 0) < max);
    if (!ok.length) { const low = Math.min(...pool.map(k => count[k] || 0)); ok = pool.filter(k => (count[k] || 0) === low); }
    const k = ok[Math.floor(rng() * ok.length)];
    count[k] = (count[k] || 0) + 1;
    m.cls = k;
  }
  // 특성 (02 5-2-1): 직업을 다 뽑은 뒤 같은 난수로 (직업 결과는 그대로)
  for (const m of list) {
    const t = (Object.keys(TRAITS) as TraitKey[]).filter(k => TRAITS[k].roles.includes(m.role));
    if (t.length && rng() < TRAIT_CHANCE) m.traits = [t[Math.floor(rng() * t.length)]];
  }
  return list;
}

function makeParty(f: Fight, roster?: RosterEntry[]): void {
  const mult = f.mythic ? MYTHIC.party : 1;
  const units: Unit[] = [];
  const add = (role: Role, pers: PersName | null, nick: string, cls?: ClassKey, traits?: TraitKey[]): Unit => {
    const c = cls ? CLASSES[cls] : null;
    const lv = role === 'healer' ? f.power : f.scale;
    const base = (c ? c.hp : role === 'tank' ? 1000 : role === 'healer' ? 550 : 600) * mult * lv;
    const dps = (c ? c.dps * 10 : role === 'tank' ? 4 : role === 'healer' ? 0 : 10) * mult * f.scale;
    const u: Unit = {
      id: f.nextId++, role, cls: c ? c.key : null, aim: 0, flow: 0, traits: (traits || []).filter(k => TRAITS[k]), bulwark: 0, bulwarkUsed: false, pers, p: pers ? PERS[pers] : {}, nick, base, max: base, hp: base, dps, alive: true,
      cell: -1, home: -1, hot: 0, hotTick: 0, echo: [], guardian: 0, shield: 0, debuffs: [], moving: null, react: null,
      retryAt: 0, mistakeUntil: 0, wrongUntil: 0, fleeing: false, sulking: false, lastHeal: 0, thanks: 0, flash: 0,
      barkAt: -10, ignoreZone: 0, homeAt: null, diedAt: 0, me: role === 'healer',
    };
    units.push(u);
    return u;
  };
  const roles = roster || rollParty(f.enc.key, f.cfg.seed || 1);
  roles.forEach(r => add(r.role, r.pers, r.nick, r.cls, r.traits));
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
  tankWatch(f);
  bossTick(f);
  if (!f.invuln) {
    const d = partyDps(f) * DT;
    if (f.mobs.length) hitMobs(f, d); else f.bossHp -= d;
    f.dpsAcc += d;
  }
  if (f.k % 20 === 0 && f.dpsAcc > 0) { emit(f, { type: 'dps', amt: Math.round(f.dpsAcc) }); f.dpsAcc = 0; }
  const live = living(f);
  if (f.bossHp <= 0) { f.bossHp = 0; end(f, 'win', f.mobs.length ? '모두 쓰러뜨림' : '보스를 쓰러뜨림'); }
  else if (!f.me.alive) end(f, 'lose', '힐러가 쓰러짐');
  // 탱커가 쓰러져도 계속, 파티원이 모두 쓰러지면 전멸 (2026-10-07 Lim)
  else if (!live.some(u => !u.me)) end(f, 'lose', '파티 전멸');
}

/** 탱커가 모두 쓰러지면 보스는 다음 사람을 때림 (aggroTarget). 그 사람이 버팀목이면 잠깐 버팀 */
function tankWatch(f: Fight): void {
  if (f.party.some(u => u.role === 'tank' && u.alive)) return;
  const u = aggroTarget(f);
  if (!u || u.me || u.bulwarkUsed || !u.traits.includes('bulwark')) return;
  u.bulwarkUsed = true; u.bulwark = BULWARK.sec;
  bark(f, u, '내가 막을게!', true);
  emit(f, { type: 'msg', text: `${u.nick} ${TRAITS.bulwark.name}: ${BULWARK.sec}초 버팀` });
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
