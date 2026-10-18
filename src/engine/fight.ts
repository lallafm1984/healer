import { NO_TANK_MIN_PARTY, NO_TANK_SEC } from '../data/armor';
import { BOARDS, PROTO_BOARDS } from '../data/boards';
import { CLASSES, RECRUIT_CLASSES, sameClassMax, type ClassKey } from '../data/classes';
import { DIFFS, MYTHIC } from '../data/difficulty';
import { ENCOUNTERS, type Encounter, type EncounterKey } from '../data/encounters';
import { gearStats, protoGearStats } from '../data/gear';
import { HEROES } from '../data/heroes';
import { TIER_MANA, TIER_MANA_BY } from '../data/heroConst';
import { openTiers } from '../data/talents';
import { TUNE } from '../data/tune';
import { pickMember, pickNick } from '../data/nicknames';
import { dayOffset, fmFx, memberLevel, STAT_KEYS, type Stats } from '../data/fm';
import { dealerOutput, dealerThreat, threatInit, threatTick } from './threat';
import { NICKS, PERS, PROTO_PERS, type PersName, type Personality } from '../data/personalities';
import { POS_RULES, PROTO_RULES, RULES } from '../data/rules';
import { makeCells } from './board';
import { initBoss, bossTick } from './bosses';
import { bossTaken, focusOrder } from './bossParts';
import { affixTick, initAffixes } from './affixes';
import { damageMob, DT, emit } from './core';
import { healerTick, knowsPassive } from './healer';
import { adjAllies, centerX, ZONE_PREF, zoneOf } from './movement';
import { looseTick, posPref } from './position';
import { rngFrom } from './rng';
import { unitDps, unitTick } from './units';
import { rollAbility } from '../data/abilities';
import { newTalents } from './talents';
import { abTick, giveAb } from './abilities';
import { followPref, gatherMult, initPers, posPersPref, persTick } from './persona';
import { newSpecs, sv } from './specials';
import type { Cell, Fight, FightConfig, FightResult, Mob, Role, RosterEntry, TalentState, Unit } from './types';

/** 전투 만들기 */
export function create(cfg: FightConfig): Fight {
  const enc = ENCOUNTERS[cfg.encounter];
  const diff = DIFFS[cfg.diff];
  const rng = rngFrom(cfg.seed || 1);
  const gear = cfg.gearStats ? { ...cfg.gearStats } : cfg.proto ? protoGearStats(cfg.gear || 'none') : gearStats(cfg.gear || 'none', cfg.stageLv ?? cfg.heroLv ?? cfg.level); // 프리셋 장비의 아이템 레벨 = 그 장소 적 레벨
  const encBoard = (cfg.proto && PROTO_BOARDS[enc.key]) || enc.board;
  const board = cfg.board && BOARDS[cfg.board] && BOARDS[cfg.board].flat().length === BOARDS[encBoard].flat().length ? cfg.board : encBoard;
  const cells = makeCells(BOARDS[board]);
  const rows = BOARDS[board].length;
  const mythic = cfg.diff === '악몽';
  const R = cfg.proto ? PROTO_RULES : RULES;
  // 장비 가속은 상한까지 (34 1-2: 50% = GCD 1.0초 바닥), 치명타는 기본값 + 장비
  gear.haste = Math.min(gear.haste, R.hasteCap);
  gear.crit += R.baseCrit;
  gear.heal *= R.heal; // 치유 배율 (34 1-6): 모든 힐 · 보호막 · 화면의 지능 값이 gear.heal을 거침
  // 레벨 배율 (34 1-2): 단계가 같으면 비율은 그대로이고 숫자만 커짐. 적·파티원은 내 레벨 세기 × 0.95, 단계보다 높은 만큼 힐러가 세짐
  const stageLv = cfg.stageLv ?? 1;
  const scale = R.lv(stageLv) * R.enemy;
  const power = R.lv(Math.max(cfg.heroLv ?? stageLv, stageLv)) * R.apex(cfg.heroLv ?? stageLv);
  const bm = cfg.bossMult ?? { hp: 1, dmg: 1 };
  const tn = cfg.proto ? undefined : (cfg.tune ?? TUNE[enc.key]?.[cfg.diff]);
  const bossMax = enc.hp * (mythic ? MYTHIC.bossHp : 1) * scale * bm.hp * (tn?.hp ?? 1);
  const f: Fight = {
    board,
    cfg, enc, diff, rng, gear, cells, rows, mythic,
    t: 0, k: 0, over: null, reason: '',
    dmgMult: diff.dmg * scale * R.enemyDmg * bm.dmg * (tn?.dmg ?? 1), scale, power,
    bossMax, bossHp: bossMax, mobs: [],
    mana: 100, gcd: 0, gcdBase: R.gcd / (1 + gear.haste), cast: null, channel: 0, chTick: 0, queued: null,
    cd: { purify: 0, guardian: 0, hymn: 0 },
    g: { p: 0 }, symbolUsed: false, symbol: 0, level: cfg.level ?? 100,
    hero: cfg.hero ?? 'priest', power3: 0, beacon: null, beaconCd: 0, rebirthUsed: false, sanctuary: null, relay: null,
    totems: [], beat: 0, beatUntil: 0, shards: 0,
    tx: null as unknown as TalentState, // 아래 newTalents
    manaCut: 1,
    abOn: false, ab: { weak: 0, weakUntil: 0, taunt: 0, tauntUntil: 0, addDot: null }, aff: null,
    skills: [], tels: [], zones: [], events: [], phase: 1, phaseName: '', invuln: false,
    enraged: false, armor: cfg.armor !== false, R, noTankAt: null, bodyHp: false, rats: [], bs: {}, order: null, daze: null, invertTap: null, empower: 0, lock: {}, watch: null, stagger: null, souls: [], links: [], vessel: null, melt: null, glass: [], bless: null, weak: null, expose: null, sp: cfg.proto ? null : newSpecs(cfg.specs), hold: null, sub: null, loose: null, slow: null, cheer: null, dark: false, split: false,
    stats: { healed: 0, overheal: 0, deaths: 0, minMana: 100, dispels: 0, dispellable: 0, trapPops: 0, queueLost: 0, casts: {}, taps: 0, missTaps: 0, emptyTaps: 0, cancels: 0, manaFails: 0, hymnBroken: 0 },
    nextId: 1,
    party: [],
    me: null as unknown as Unit, // makeParty에서 채움
  };
  f.tx = newTalents(f);
  // 특성 단 마나 보정: 열린 특성 단마다 마나 소모 −2% (세 직업 공통, heroConst TIER_MANA · 77). 프로토타입 일치 테스트는 그대로
  if (!cfg.proto) f.manaCut = 1 - (TIER_MANA_BY[f.hero] ?? TIER_MANA) * openTiers(f.level);
  if (cfg.carry) { f.mana = cfg.carry.mana; f.stats.minMana = f.mana; f.g = { ...cfg.carry.g }; }
  if (!knowsPassive(f, 'words')) f.g = { p: 0 };
  makeParty(f, cfg.party);
  // 성기사 봉화는 첫 탱커에게 걸고 시작 (휠 가운데로 바꿈, 25 3장)
  if (f.hero === 'paladin' && f.level >= HEROES.paladin.system.lv) { const t = f.party.find(u => u.role === 'tank'); if (t) f.beacon = t.id; }
  initBoss(f);
  threatInit(f); // 어그로 (96): 보스 · 주시를 안 뒤
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
    let pool = PROTO_PERS.filter(p => !(role === 'tank' && 'noTank' in PERS[p]));
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
 * 공개모집 구성 (76 문서, 2026-10-14 Lim 「각 전투 마다 인원 배정이 랜덤하게」): 탱커 수는 그대로, 나머지 자리는 한 자리씩 근접 · 원거리 반반.
 * 탐험 3인 = 탱커 1 + 1명, 던전 5인 = 탱커 1 + 3명, 10인 = 탱커 2 + 7명, 20인 = 탱커 2 + 17명. 순서는 탱커 → 근접 → 원거리.
 * 근접은 판의 앞 두 줄 (위치 규칙: 근접은 1 · 2열에서만 딜)에서 탱커 자리를 뺀 만큼까지 (20인 10명), 넘는 자리는 원거리
 */
export function partyRoles(encKey: EncounterKey, seed: number): RosterEntry['role'][] {
  const enc = ENCOUNTERS[encKey], c = enc.comp, r = rngFrom(Math.imul(seed, 0x632be5ab) ^ 0x2545f491);
  const n = c.melee + c.ranged;
  let melee = 0;
  for (let i = 0; i < n; i++) if (r() < MELEE_SHARE) melee++;
  melee = Math.min(melee, meleeCap(enc));
  return [...Array<'tank'>(c.tank).fill('tank'), ...Array<'melee'>(melee).fill('melee'), ...Array<'ranged'>(n - melee).fill('ranged')];
}
/** 딜러 한 자리가 근접일 확률 (나머지는 원거리) */
export const MELEE_SHARE = 0.5;
/** 근접이 딜할 수 있는 자리 수: 판 앞 두 줄 (POS_RULES.meleeRows) 칸 − 탱커 */
export const meleeCap = (enc: Encounter): number => Math.max(0, BOARDS[enc.board].slice(0, POS_RULES.meleeRows).reduce((a, row) => a + row.length, 0) - enc.comp.tank);

/**
 * 공개모집 (17 2-1): 구성을 무작위로 정하고 (partyRoles), 역할마다 Lv 1 직업을 붙인 뒤, 그 직업 파티원 목록 (74 · 75: 닉네임 · 성격 · 직업 스킬이 묶인 200명)에서 1명씩.
 * 같은 직업은 5인 1명 · 10인 2명 · 20인 3명까지 (자리가 모자라면 가장 적은 직업부터 더 넣음).
 * 저레벨 던전은 희귀 성격 없이 · 탱커 ★1 · ★★★ 파티당 1명 (04 6-F).
 */
export function recruitParty(encKey: EncounterKey, seed: number, opts: { abilities?: boolean; myLv?: number; stageLv?: number; exclude?: ReadonlySet<string> } = {}): RosterEntry[] {
  const list: RosterEntry[] = partyRoles(encKey, seed).map(role => ({ role, pers: '신중파', nick: '' }));
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
  // 파티원 (75): 직업 목록에서 겹치지 않게 1명 = 닉네임 · 성격 · 직업 스킬 (17 3장, 튜토리얼 파티는 스킬 없음). 직업 난수와 따로 굴림
  // 파티원은 성격과 직업 스킬만 가짐 (2026-10-12 Lim: 직업 패시브 · 특성 뺌)
  const nr = rngFrom(Math.imul(seed, 0x27d4eb2f) ^ 0x165667b1);
  const used = new Set<string>(opts.exclude ?? []), low = !!ENCOUNTERS[encKey].lowLevel; // 길드원은 공개모집에서 빠짐 (93 7-2)
  let hard = 0;
  // 97 FM: 내 레벨 · 칸 레벨을 알면 저마다 레벨 (칸 ±1인 사람만), 능력치 · 이번 판 꾸준함 흔들림 (판 시드). 튜토리얼 파티 (스킬 없음)는 예전 그대로.
  // 세상 레벨 = 내 레벨과 칸 레벨 중 높은 쪽 (힐러 힘 max(내 Lv, 칸 Lv)와 같은 규칙): 내가 칸보다 낮으면 (Lv 1~20 성장 길의 어려움 · 악몽) 칸 레벨 근처 사람이 없어 모집이 칸보다 크게 약했음
  const fm = !!opts.abilities;
  const lv = fm && opts.myLv != null && opts.stageLv != null ? { my: Math.max(opts.myLv, opts.stageLv), stage: opts.stageLv } : undefined;
  for (const m of list) {
    const p = pickMember(m.cls!, nr, used, { low, tank: m.role === 'tank', hard, lv });
    if (p) {
      m.nick = p.nick; m.pers = p.pers; if (opts.abilities) m.ab = p.ab;
      if (fm) m.fm = { stats: p.fm.stats, off: dayOffset(p.fm.steady, seed, p.nick) };
      if (lv) { m.lv = memberLevel(p.fm.speed, lv.my); m.pub = true; }
    }
    else { m.nick = pickNick(m.cls!, nr, used); if (opts.abilities) m.ab = rollAbility(m.cls!, nr); } // 목록을 다 씀 (거의 없음): 이름 뒤 숫자
    if (PERS[m.pers].star === 3) hard++;
    used.add(m.nick);
  }
  return list;
}

function makeParty(f: Fight, roster?: RosterEntry[]): void {
  const mult = f.mythic ? MYTHIC.party : 1;
  const units: Unit[] = [];
  const add = (role: Role, pers: PersName | null, nick: string, cls?: ClassKey, r?: RosterEntry): Unit => {
    const c = cls ? CLASSES[cls] : null;
    // 길드원은 자기 레벨 배율 (적 레벨 위로는 안 감, 34 4장 8번), 공개모집은 콘텐츠 단계 배율. 자질 공격·맷집 (17 9-1)
    const own = r?.lv ? f.R.lv(r.pub ? r.lv : Math.min(r.lv, f.cfg.stageLv ?? r.lv)) * f.R.enemy : f.scale; // 공개모집은 자기 레벨 그대로 (97 FM)
    const lv = role === 'healer' ? f.power : own;
    let base = (c ? c.hp : role === 'tank' ? 1000 : role === 'healer' ? 550 : 600) * mult * lv;
    let dps = (c ? c.dps * 10 : role === 'tank' ? 4 : role === 'healer' ? 0 : 10) * mult * own;
    const fx = r?.fm ? fmFx(r.fm.stats, r.fm.off) : undefined; // 능력치 (97 FM): 공개모집 · 길드원
    if (fx) { base *= fx.hp; dps *= fx.dps; }
    if (role === 'healer' && f.gear.hp) base *= 1 + f.gear.hp; // 장비 체력 (34 6-5)
    const u: Unit = {
      id: f.nextId++, role, cls: c ? c.key : null, acc: 0, dealt: 0, pers, p: pers ? habitPers(PERS[pers], r?.habit) : {}, nick, base, max: base, hp: base, dps, alive: true,
      cell: -1, home: -1, hot: 0, hotTick: 0, hots: [], redu: 0, reduCut: 0, sacr: 0, immune: 0, echo: [], guardian: 0, shield: 0, debuffs: [], moving: null, react: null,
      retryAt: 0, mistakeUntil: 0, wrongUntil: 0, fleeing: false, sulking: false, lastHeal: 0, thanks: 0, flash: 0,
      barkAt: -10, ignoreZone: 0, homeAt: null, diedAt: 0, me: role === 'healer',
      ab: null, mods: [], got: 0, senseReact: fx ? fx.react : 1, senseDodge: fx ? fx.dodge : 0, gid: r?.gid, bond: r?.bond ?? 0,
    };
    if (r?.gid != null) u.did = { dodge: 0, move: 0, cut: 0, buster: 0, adds: 0 }; // 길드원 「한 일」 (97)
    if (fx) { u.fm = fx; u.fmStats = Object.fromEntries(STAT_KEYS.map(k => [k, r!.fm!.stats[k] + r!.fm!.off])) as Stats; }
    if (role !== 'healer') u.lv = r?.lv ? (r.pub ? r.lv : Math.min(r.lv, f.cfg.stageLv ?? r.lv)) : (f.cfg.stageLv ?? 1); // 어그로 레벨 차이 (96)
    else u.lv = Math.max(f.cfg.heroLv ?? f.cfg.stageLv ?? 1, f.cfg.stageLv ?? 1);
    units.push(u);
    return u;
  };
  const roles = roster || rollParty(f.enc.key, f.cfg.seed || 1);
  roles.forEach(r => { const u = add(r.role, r.pers, r.nick, r.cls, r); if (r.ab) giveAb(f, u, r.ab, r.star); });
  add('healer', null, '나');
  f.party = units;
  f.me = units[units.length - 1];
  // 배치 (04 5-2): 탱커 → 나 → 근접 → 원거리. 위치 규칙 (2026-10-13 Lim): 탱커 1열 · 근접 1 · 2열 · 레이드 원거리 3열부터 (자리가 모자랄 때만 밖으로)
  const cx = centerX(f);
  const order = [...units.filter(u => u.role === 'tank'), f.me, ...units.filter(u => u.role === 'melee'), ...units.filter(u => u.role === 'ranged')];
  for (const u of order) {
    let best: Cell | null = null, bs = -Infinity;
    for (const c of f.cells) {
      if (c.unit) continue;
      let s = ZONE_PREF[u.role][zoneOf(f, c.row)] + posPref(f, u.role, c, 100);
      if (u.role === 'tank' || u.role === 'healer') s -= Math.abs(c.px - cx) * 6;
      if (u.role === 'tank') s -= c.row * 30;
      s += (u.p.dist || 0) * adjAllies(f, c, u) * 8;
      if (u.p.dist === -1) s += Math.abs(c.px - cx) * 4;
      if (u.p.follow) s += followPref(f, u, c); // 따라쟁이: 탱커 옆 (75)
      if (u.p.front || u.p.backline) s += posPersPref(f, u, c) * 2; // 앞장이 · 뒷줄파 (95)
      s += f.rng() * 3;
      if (s > bs) { bs = s; best = c; }
    }
    best!.unit = u; u.cell = best!.i; u.home = best!.i;
  }
  initPers(f); // 새 성격 상태 · 미신쟁이 명당 (75)
}

/** 한 틱 (0.05초) */
export function step(f: Fight): void {
  if (f.over) return;
  f.t += DT; f.k++;
  healerTick(f);
  for (const u of f.party) unitTick(f, u);
  if (f.abOn) abTick(f);
  if (f.persOn) persTick(f); // 95 성격: 쫄 모으기 · 어그로 흘림 · 자급자족 · 자립형
  if (f.aff) affixTick(f);
  tankWatch(f);
  looseTick(f); // 탱커 앞줄 이탈 (위치 규칙)
  bossTick(f);
  partyHits(f);
  if (f.thr) threatTick(f); // 어그로 (96)
  if (f.bossHp <= 0) { f.bossHp = 0; end(f, 'win', f.mobs.some(m => !m.add) && !f.mobs.some(m => m.boss) ? '모두 쓰러뜨림' : '보스를 쓰러뜨림'); }
  else if (!f.me.alive) end(f, 'lose', '힐러가 쓰러짐');
  // 탱커가 쓰러져도 계속, 파티원이 모두 쓰러지면 전멸 (2026-10-07 Lim)
  else if (!f.party.some(u => u.alive && !u.me)) end(f, 'lose', '파티 전멸'); // 띄워 올려진 사람도 살아 있음 (P-LIFT)
}

/**
 * 탱커가 모두 쓰러지면 보스는 다음 사람을 때림 (bosses.ts aggroTarget).
 * 5인 이상 보스전은 「탱커 없음」 카운트다운이 끝나면 보스가 바로 광폭화 (35 6-4, bosses.ts enrageAt). 탱커를 일으키면 사라짐
 */
function tankWatch(f: Fight): void {
  // 대타 (95): 딜러가 보스를 붙잡은 동안은 탱커 없음 광폭화를 세지 않음 (끝나면 그때부터)
  if (f.standIn && f.t < f.standIn.until && f.party.some(u => u.id === f.standIn!.id && u.alive)) { f.noTankAt = null; return; }
  if (f.party.some(u => u.role === 'tank' && u.alive)) {
    if (f.noTankAt != null) { f.noTankAt = null; if (!f.enraged) emit(f, { type: 'msg', text: '탱커가 일어남: 광폭화 카운트다운 멈춤' }); }
    return;
  }
  if (f.armor && f.noTankAt == null && !f.enraged && f.enc.script !== 'trash' && f.party.length >= NO_TANK_MIN_PARTY && f.party.some(u => u.role === 'tank')) {
    f.noTankAt = f.t;
    emit(f, { type: 'msg', text: `탱커 없음: ${NO_TANK_SEC}초 뒤 보스 광폭화` });
  }
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
    if (f.invuln && !(u.role !== 'tank' && f.mobs.some(m => m.alive && m.add))) continue; // 인터미션 무적: 딜러는 판 위 적 (감옥)만 침
    u.acc += unitDps(u, f) * DT;
    if ((f.k + u.id * 7) % SWING[u.role as Exclude<Role, 'healer'>] !== 0 || u.acc <= 0 || f.bossHp <= 0) continue;
    const amt = u.acc;
    if (f.stagger && u.hp >= u.max * f.stagger.hp - 1e-9) f.stagger.fill += amt * (u.role === 'tank' ? f.stagger.tank : 1); // 무력화 게이지 (P-STAGGER)
    u.dealt += Math.min(amt, f.bossHp);
    u.acc = 0;
    if (f.bodyHp) hitMobs(f, amt, u);
    else if (u.role !== 'tank' && f.mobs.length && !(u.p.oneTrack && !f.invuln)) { hitAdds(f, amt, u); if (f.thr) dealerOutput(f, amt); } // 외골수 (95): 보스만 (무적일 때는 쫄). 어그로: 쫄 딜은 탱커 위협 바탕에만
    else {
      f.bossHp -= amt * (f.daze || f.expose || f.mobs.length ? bossTaken(f) : 1) * (u.p.addHunter?.boss ?? u.p.oneTrack?.boss ?? 1); // 멍함 · 영혼 축복 · 보호막 수정 (35 3-I) · 쫄 사냥꾼 · 외골수 (95)
      if (f.thr && u.role !== 'tank') dealerThreat(f, u, amt); // 어그로 (96): 보스에게 준 딜. 탱커는 threatTick이 쌓음
    }
    emit(f, { type: 'hit', uid: u.id, amt });
  }
}

/**
 * 보스 전투의 쫄 (P-ADD): 딜러는 먼저 나온 쫄부터, 쫄이 다 쓰러지면 남는 딜은 보스에게. 쫄 떼는 범위 딜로 같이 맞음.
 * 95: 쫄 사냥꾼은 쫄에게 ×add · 보스에게 ×boss, 쫄 모으기 탱커에게 쫄이 모여 있으면 쫄에게 ×aoe
 */
/** 길드원 버릇 (97 · 93 13-1): 침착 · 판단이 높으면 성격 단점 (느린 반응 · 회피 −)이 줄어듦. 성격 표 (PERS)는 그대로, 그 유닛 사본만 */
function habitPers(p: Partial<Personality>, h = 1): Partial<Personality> {
  if (Math.abs(h - 1) < 1e-9) return p;
  const q: Partial<Personality> = { ...p };
  if (q.react != null && q.react > 1) q.react = 1 + (q.react - 1) * h;
  if (q.dodge != null && q.dodge < 0) q.dodge *= h;
  return q;
}

function hitAdds(f: Fight, d: number, u: Unit): void {
  const hunt = u.p.addHunter, am = (hunt?.add ?? 1) * (f.persOn ? gatherMult(f) : 1) * (u.fm?.adds ?? 1); // 쫄 처리 (97 FM)
  if (u.did) u.did.adds += d;
  let left = d, cleaved = false;
  for (const m of focusOrder(f)) { // 일점사 (P-FOCUS): 먼저 잡을 것부터
    if (left <= 1e-9) break;
    if (m.add!.cleave) { // 쫄 떼 (P-SWARM): 떼 전체에 한 번, 남는 딜은 일점사 대상 몫만 넘김
      if (cleaved) continue;
      cleaved = true;
      for (const o of f.mobs) if (o !== m && o.alive && o.add?.cleave) damageMob(f, o, Math.min(o.hp, left * am));
    }
    const boost = (f.sp && (m.add!.job?.p === 'pylon' || m.add!.job?.p === 'mend') ? 1 + sv(f, 'crystalBreak') : 1) * am; // 수정 깨기 (42 기믹 05)
    const x = Math.min(m.hp, left * boost);
    left -= x / boost;
    damageMob(f, m, x);
  }
  if (left > 1e-9 && !f.invuln) f.bossHp -= left * bossTaken(f) * (hunt?.boss ?? 1);
}

/**
 * 일반·정예 구간: 파티 딜은 잡을 차례인 적에게, 남는 딜은 다음 적에게 (23 2장).
 * 고르게 깎는 몸통 (쌍둥이 여군주): 체력이 많은 몸통부터, 딜 욕심쟁이는 적은 쪽부터
 */
function hitMobs(f: Fight, d: number, u?: Unit): void {
  let left = d;
  const order = f.split ? f.mobs.filter(m => m.alive && !m.add).sort((a, b) => (u?.p.greedy ? a.hp - b.hp : b.hp - a.hp))
    : u?.p.oneTrack ? f.mobs.filter(m => m.alive && !m.add).sort((a, b) => Number(!!(b.boss || b.elite)) - Number(!!(a.boss || a.elite))) // 외골수 (95): 정예부터
    : f.mobs;
  for (const m of order) {
    if (!m.alive || m.add) continue;
    const x = Math.min(m.hp, left);
    m.hp -= x; left -= x;
    if (m.hp <= 1e-9) mobDown(f, m);
    if (left <= 1e-9) break;
  }
  f.bossHp = f.mobs.reduce((s, m) => s + (m.add ? 0 : m.hp), 0);
}

/** 일반 · 정예 몸통이 쓰러짐: 시전 중이던 기술도 끊김 */
function mobDown(f: Fight, m: Mob): void {
  m.hp = 0; m.alive = false;
  f.tels = f.tels.filter(t => t.skill.mob !== m.id);
  emit(f, { type: 'mobDown', id: m.id, name: m.name });
}

function end(f: Fight, result: FightResult, reason: string): void {
  f.over = result; f.reason = reason;
  emit(f, { type: 'over', result });
}
