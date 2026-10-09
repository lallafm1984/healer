import { NO_TANK_MIN_PARTY, NO_TANK_SEC } from '../data/armor';
import { BOARDS } from '../data/boards';
import { CLASSES, RECRUIT_CLASSES, sameClassMax, type ClassKey } from '../data/classes';
import { DIFFS, MYTHIC } from '../data/difficulty';
import { ENCOUNTERS, type EncounterKey } from '../data/encounters';
import { gearStats } from '../data/gear';
import { HEROES } from '../data/heroes';
import { TALENT_STANDIN } from '../data/heroConst';
import { TALENTS } from '../data/talents';
import { ITEMS } from '../data/items';
import { NICKS, PERS, PERS_NAMES, type PersName } from '../data/personalities';
import { PROTO_RULES, RULES } from '../data/rules';
import { BULWARK, TRAIT_CHANCE, TRAITS, type TraitKey } from '../data/traits';
import { makeCells } from './board';
import { aggroTarget, initBoss, bossTick } from './bosses';
import { bossTaken, focusOrder } from './bossParts';
import { affixTick, initAffixes } from './affixes';
import { bark, damageMob, DT, emit, living } from './core';
import { healerTick, knowsPassive } from './healer';
import { adjAllies, centerX, ZONE_PREF, zoneOf } from './movement';
import { rngFrom } from './rng';
import { unitDps, unitTick } from './units';
import { APT, aptIdx } from '../data/guild';
import { rollAbility } from '../data/abilities';
import { newTalents } from './talents';
import { abTick, giveAb } from './abilities';
import type { Cell, Fight, FightConfig, FightResult, Role, RosterEntry, TalentState, Unit } from './types';

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
  const R = cfg.proto ? PROTO_RULES : RULES;
  // 장비 가속은 상한까지 (34 1-2: 50% = GCD 1.0초 바닥), 치명타는 기본값 + 장비
  gear.haste = Math.min(gear.haste, R.hasteCap);
  gear.crit += R.baseCrit;
  // 레벨 배율 (34 1-2): 단계가 같으면 비율은 그대로이고 숫자만 커짐. 적·파티원은 내 레벨 세기 × 0.95, 단계보다 높은 만큼 힐러가 세짐
  const stageLv = cfg.stageLv ?? 1;
  const scale = R.lv(stageLv) * R.enemy;
  const power = R.lv(Math.max(cfg.heroLv ?? stageLv, stageLv)) * R.apex(cfg.heroLv ?? stageLv);
  const bm = cfg.bossMult ?? { hp: 1, dmg: 1 };
  const tn = cfg.proto ? undefined : enc.tune?.[cfg.diff];
  const bossMax = enc.hp * (mythic ? MYTHIC.bossHp : 1) * scale * bm.hp * (tn?.hp ?? 1);
  const f: Fight = {
    board,
    cfg, enc, diff, rng, gear, cells, rows, mythic,
    t: 0, k: 0, over: null, reason: '',
    dmgMult: diff.dmg * scale * R.enemyDmg * bm.dmg * (tn?.dmg ?? 1), scale, power,
    bossMax, bossHp: bossMax, mobs: [],
    mana: 100, gcd: 0, gcdBase: R.gcd / (1 + gear.haste), cast: null, channel: 0, chTick: 0, queued: null,
    cd: { purify: 0, guardian: 0, hymn: 0 },
    g: { p: 0, s: 0 }, symbolUsed: false, symbol: 0, level: cfg.level ?? 100,
    hero: cfg.hero ?? 'priest', power3: 0, beacon: null, beaconCd: 0, rebirthUsed: false, sanctuary: null,
    tx: null as unknown as TalentState, // 아래 newTalents
    standin: null,
    abOn: false, ab: { weak: 0, weakUntil: 0, taunt: 0, tauntUntil: 0, addDot: null }, aff: null,
    skills: [], tels: [], zones: [], events: [], phase: 1, phaseName: '', invuln: false,
    enraged: false, armor: cfg.armor !== false, R, noTankAt: null, bodyHp: false, rats: [], bs: {}, order: null, daze: null, invertTap: null, empower: 0, lock: {}, watch: null,
    items: {}, potCd: 0, medit: 0, itemLog: [],
    stats: { healed: 0, overheal: 0, deaths: 0, minMana: 100, dispels: 0, dispellable: 0, trapPops: 0, queueLost: 0, casts: {}, taps: 0, missTaps: 0, emptyTaps: 0, cancels: 0, manaFails: 0, hymnBroken: 0 },
    nextId: 1,
    party: [],
    me: null as unknown as Unit, // makeParty에서 채움
  };
  f.tx = newTalents(f);
  // 특성 트리가 없는 직업: 열린 특성 단마다 힐량 보정 (임시)
  if (TALENT_STANDIN.heroes.includes(f.hero)) {
    const n = TALENTS.filter(t => t.lv <= f.level).length;
    f.standin = { heal: 1 + TALENT_STANDIN.heal * n, mana: 1 - TALENT_STANDIN.mana * n, guard: 1 - TALENT_STANDIN.guard * n };
  }
  for (const k of (cfg.items || []).slice(0, 4)) if (ITEMS[k]) f.items[k] = Math.max(0, Math.min(ITEMS[k].uses, cfg.itemCap?.[k] ?? Infinity));
  if (cfg.carry) { f.mana = cfg.carry.mana; f.stats.minMana = f.mana; f.g = { ...cfg.carry.g }; }
  if (!knowsPassive(f, 'words')) f.g = { p: 0, s: 0 };
  makeParty(f, cfg.party);
  // 성기사 봉화는 첫 탱커에게 걸고 시작 (휠 가운데로 바꿈, 25 3장)
  if (f.hero === 'paladin' && f.level >= HEROES.paladin.system.lv) { const t = f.party.find(u => u.role === 'tank'); if (t) f.beacon = t.id; }
  initBoss(f);
  if (cfg.affixes?.length) initAffixes(f, cfg.affixes);
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
export function recruitParty(encKey: EncounterKey, seed: number, opts: { abilities?: boolean } = {}): RosterEntry[] {
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
  // 특수 능력 1개 (17 3장): 특성까지 뽑은 뒤 같은 난수로 (직업·특성 결과는 그대로). 튜토리얼 파티는 능력 없음
  if (opts.abilities) for (const m of list) m.ab = rollAbility(m.cls!, rng);
  return list;
}

function makeParty(f: Fight, roster?: RosterEntry[]): void {
  const mult = f.mythic ? MYTHIC.party : 1;
  const units: Unit[] = [];
  const add = (role: Role, pers: PersName | null, nick: string, cls?: ClassKey, traits?: TraitKey[], r?: RosterEntry): Unit => {
    const c = cls ? CLASSES[cls] : null;
    // 길드원은 자기 레벨 배율 (적 레벨 위로는 안 감, 34 4장 8번), 공개모집은 콘텐츠 단계 배율. 자질 공격·맷집 (17 9-1)
    const own = r?.lv ? f.R.lv(Math.min(r.lv, f.cfg.stageLv ?? r.lv)) * f.R.enemy : f.scale;
    const lv = role === 'healer' ? f.power : own;
    const apt = r?.apt;
    let base = (c ? c.hp : role === 'tank' ? 1000 : role === 'healer' ? 550 : 600) * mult * lv;
    let dps = (c ? c.dps * 10 : role === 'tank' ? 4 : role === 'healer' ? 0 : 10) * mult * own;
    if (apt) { base *= APT.tough[aptIdx(apt[1])]; dps *= APT.atk[aptIdx(apt[0])]; }
    const u: Unit = {
      id: f.nextId++, role, cls: c ? c.key : null, aim: 0, flow: 0, traits: (traits || []).filter(k => TRAITS[k]), bulwark: 0, bulwarkUsed: false, acc: 0, dealt: 0, pers, p: pers ? PERS[pers] : {}, nick, base, max: base, hp: base, dps, alive: true,
      cell: -1, home: -1, hot: 0, hotTick: 0, hots: [], redu: 0, reduCut: 0, sacr: 0, immune: 0, echo: [], guardian: 0, shield: 0, debuffs: [], moving: null, react: null,
      retryAt: 0, mistakeUntil: 0, wrongUntil: 0, fleeing: false, sulking: false, lastHeal: 0, thanks: 0, flash: 0,
      barkAt: -10, ignoreZone: 0, homeAt: null, diedAt: 0, me: role === 'healer',
      ab: null, mods: [], got: 0, senseReact: apt ? APT.react[aptIdx(apt[2])] : 1, senseDodge: apt ? APT.dodge[aptIdx(apt[2])] : 0, gid: r?.gid, runs: r?.runs ?? 0,
    };
    units.push(u);
    return u;
  };
  const roles = roster || rollParty(f.enc.key, f.cfg.seed || 1);
  roles.forEach(r => { const u = add(r.role, r.pers, r.nick, r.cls, r.traits, r); if (r.ab) giveAb(f, u, r.ab, r.star); });
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
  if (f.abOn) abTick(f);
  if (f.aff) affixTick(f);
  tankWatch(f);
  bossTick(f);
  partyHits(f);
  const live = living(f);
  if (f.bossHp <= 0) { f.bossHp = 0; end(f, 'win', f.mobs.some(m => !m.add) && !f.mobs.some(m => m.boss) ? '모두 쓰러뜨림' : '보스를 쓰러뜨림'); }
  else if (!f.me.alive) end(f, 'lose', '힐러가 쓰러짐');
  // 탱커가 쓰러져도 계속, 파티원이 모두 쓰러지면 전멸 (2026-10-07 Lim)
  else if (!live.some(u => !u.me)) end(f, 'lose', '파티 전멸');
}

/**
 * 탱커가 모두 쓰러지면 보스는 다음 사람을 때림 (aggroTarget). 그 사람이 버팀목이면 잠깐 버팀.
 * 5인 이상 보스전은 「탱커 없음」 카운트다운이 끝나면 보스가 바로 광폭화 (35 6-4, bosses.ts enrageAt). 탱커를 일으키면 사라짐
 */
function tankWatch(f: Fight): void {
  if (f.party.some(u => u.role === 'tank' && u.alive)) {
    if (f.noTankAt != null) { f.noTankAt = null; if (!f.enraged) emit(f, { type: 'msg', text: '탱커가 일어남: 광폭화 카운트다운 멈춤' }); }
    return;
  }
  if (f.armor && f.noTankAt == null && !f.enraged && f.enc.script !== 'trash' && f.party.length >= NO_TANK_MIN_PARTY && f.party.some(u => u.role === 'tank')) {
    f.noTankAt = f.t;
    emit(f, { type: 'msg', text: `탱커 없음: ${NO_TANK_SEC}초 뒤 보스 광폭화` });
  }
  const u = aggroTarget(f);
  if (!u || u.me || u.bulwarkUsed || !u.traits.includes('bulwark')) return;
  u.bulwarkUsed = true; u.bulwark = BULWARK.sec;
  bark(f, u, '내가 막을게!', true);
  emit(f, { type: 'msg', text: `${u.nick} ${TRAITS.bulwark.name}: ${BULWARK.sec}초 버팀` });
}

/** 파티원 공격 간격 (틱): 탱커·원거리 2초, 근접 1.5초 */
const SWING: Record<Exclude<Role, 'healer'>, number> = { tank: 40, melee: 30, ranged: 40 };

/**
 * 파티원 공격 (2026-10-07 Lim: 딜은 합치지 않고 한 방씩 보이고, 적 체력도 그만큼 깎임).
 * 초당 딜을 틱마다 모았다가 공격 간격마다 한 번에 넣음 (평균 딜은 전과 같음). 사람마다 박자를 조금씩 어긋나게.
 * 보스 무적이면 모으지도 넣지도 않음. 쓰러지면 모아 둔 딜은 버림
 */
function partyHits(f: Fight): void {
  for (const u of f.party) {
    if (u.me) continue;
    if (!u.alive) { u.acc = 0; continue; }
    if (f.invuln) continue;
    u.acc += unitDps(u) * DT;
    if ((f.k + u.id * 7) % SWING[u.role as Exclude<Role, 'healer'>] !== 0 || u.acc <= 0 || f.bossHp <= 0) continue;
    const amt = u.acc;
    u.dealt += Math.min(amt, f.bossHp);
    u.acc = 0;
    if (f.bodyHp) hitMobs(f, amt);
    else if (u.role !== 'tank' && f.mobs.length) hitAdds(f, amt);
    else f.bossHp -= amt * (f.daze || f.mobs.length ? bossTaken(f) : 1); // 멍함 · 보호막 수정 (35 3-I)
    emit(f, { type: 'hit', uid: u.id, amt });
  }
}

/** 보스 전투의 쫄 (P-ADD): 딜러는 먼저 나온 쫄부터, 쫄이 다 쓰러지면 남는 딜은 보스에게. 쫄 떼는 범위 딜로 같이 맞음 */
function hitAdds(f: Fight, d: number): void {
  let left = d, cleaved = false;
  for (const m of focusOrder(f)) { // 일점사 (P-FOCUS): 먼저 잡을 것부터
    if (left <= 1e-9) break;
    if (m.add!.cleave) { // 쫄 떼 (P-SWARM): 떼 전체에 한 번, 남는 딜은 일점사 대상 몫만 넘김
      if (cleaved) continue;
      cleaved = true;
      for (const o of f.mobs) if (o !== m && o.alive && o.add?.cleave) damageMob(f, o, Math.min(o.hp, left));
    }
    const x = Math.min(m.hp, left);
    left -= x;
    damageMob(f, m, x);
  }
  if (left > 1e-9) f.bossHp -= left * bossTaken(f);
}

/** 일반·정예 구간: 파티 딜은 잡을 차례인 적에게, 남는 딜은 다음 적에게 (23 2장) */
function hitMobs(f: Fight, d: number): void {
  let left = d;
  for (const m of f.mobs) {
    if (!m.alive || m.add) continue;
    const x = Math.min(m.hp, left);
    m.hp -= x; left -= x;
    if (m.hp <= 1e-9) {
      m.hp = 0; m.alive = false;
      f.tels = f.tels.filter(t => t.skill.mob !== m.id); // 시전 중이던 기술도 끊김
      emit(f, { type: 'mobDown', id: m.id, name: m.name });
    }
    if (left <= 1e-9) break;
  }
  f.bossHp = f.mobs.reduce((s, m) => s + (m.add ? 0 : m.hp), 0);
}

function end(f: Fight, result: FightResult, reason: string): void {
  f.over = result; f.reason = reason;
  emit(f, { type: 'over', result });
}
