import { ABILITIES } from '../data/abilities';
import { armorFactor } from '../data/armor';
import { MONK, RELAY, SHAMAN } from '../data/heroConst';
import { HEROES } from '../data/heroes';
import { DISPELLABLE, SKILLS, type SkillKey } from '../data/skills';
import { hexDist } from './board';
import { aggroTarget } from './bosses';
import { ROD_HP } from './bossParts';
import { cellOf, healTop, living, submerged, unitById } from './core';
import { sv } from './specials';
import { create, step } from './fight';
import { canTarget, knows, use } from './healer';
import { setBeacon } from './heroes';
import { reviveTarget } from './items';
import { dangerAt } from './movement';
import { areaRadius, castOf, talentReady, useTalent, waveMax, waveNeed } from './talents';
import { chainPath } from './shaman';
import { breathRange, misted } from './monk';
import { asleep, fallSpec, starsNow } from './astro';
import { circleRange, judgeReady, sealed, sealTargets } from './warder';
import { absorbLeft } from './abilities';
import { totemBreaks } from './totems';
import { TX } from '../data/talents';
import type { Debuff, Fight, FightConfig, Telegraph, Unit } from './types';

/**
 * 버스터를 맞을 사람이 버틸 만큼 차 있지 않으면 그 사람 (직업군 방어력이 있을 때만).
 * 방어력이 생기면 광역이 탱커를 덜 깎아서 탱커가 「가장 낮은 사람」에서 밀리기 쉬움 → 버스터 전에 먼저 채움.
 * 예고가 짧아서(2초) 예고가 뜨기 4초 전부터 본다 (대기열에 다음 기술이 보이는 것과 같음)
 */
function busterShort(f: Fight): { u: Unit; soon: boolean } | null {
  if (!f.armor) return null;
  const short = (u: Unit | null | undefined, dmg: number) => !!u && u.alive && u.guardian <= 0 && u.hp < Math.min(healTop(u) * 0.95, dmg * f.dmgMult * armorFactor(u.role, 'tank') * 1.1 + u.max * 0.15); // 그 사이 평타 한두 대 여유. 가득 차도 못 버티는 버스터면 거의 가득까지만
  for (const t of f.tels) {
    if (t.kind !== 'buster' || !t.skill.dmg || veiled(f, t)) continue;
    const u = unitById(f, t.units[0]);
    if (short(u, t.skill.dmg)) return { u: u!, soon: t.impact - f.t < 2 };
  }
  for (const s of f.skills) {
    if (s.kind !== 'buster' || !s.dmg || s.mob != null || s.next - f.t > 4 || !s.active(f)) continue;
    const u = aggroTarget(f);
    if (short(u, s.dmg)) return { u: u!, soon: false };
  }
  return null;
}

/**
 * 가장 낮은 사람. 직업군 방어력이 있으면 힐러(나)가 가장 약한 쪽이라, 나도 거의 같이 낮으면 나부터 (내가 쓰러지면 끝)
 */
function lowest(f: Fight, live: Unit[], pct: (u: Unit) => number): Unit {
  // 어둠물 (P-TIDE, 59 5장): 잠긴 사람은 힐이 반만 드니 체력이 비슷하면 안 잠긴 사람 먼저
  const p = f.zones.length && f.zones.some(z => z.tide) ? (u: Unit) => pct(u) + (submerged(f, u) ? TIDE_BIAS : 0) : pct;
  const low = live.reduce((a, b) => (p(b) < p(a) ? b : a));
  return f.armor && f.me.alive && !off(f, f.me) && pct(f.me) < 0.6 && pct(f.me) < pct(low) + 0.15 ? f.me : low;
}

// ---------- 기믹 부품 대응 (38 0-5): 35 3장 표의 「힐러 판단」을 세 직업이 같이 봄 ----------
/**
 * 힐하면 손해인 사람: 뒤집힌 축복 (P-INVERT, 힐이 피해), 매혹 (P-CHARM, 힐하면 지배가 길어짐 → 그 사람은 두고 주변을),
 * 과부하 표식 (P-OVER)인데 모자란 양이 힐 한 번보다 적음 (넘친 치유가 이웃을 때림 → 정확히 채우기)
 */
const off = (f: Fight, u: Unit) => (u.debuffs.length > 0 && u.debuffs.some(d => d.invert || d.charm || (!!d.over && u.max - u.hp < OVER_GAP * healUnit(f))
  || (d.end?.p === 'flip' && flipWait(u, d)) || (d.link?.kind === 'share' && !!unitById(f, d.link.to)?.debuffs.some(x => x.invert))))
  || (f.zones.length > 0 && ringWait(f, u));
/**
 * 요정 고리 (P-GROW, 48 5장): 아직 더 자랄 수 있는 고리 안에 선 사람은 걸어 나올 때까지 힐하지 않음 (지속 힐 · 광역도 그 사람을 피함).
 * 체력 35% 아래면 쓰러질 수 있어 다시 힐함
 */
const ringWait = (f: Fight, u: Unit) => u.hp >= u.max * RING_LOW && f.zones.some(z => !!z.ring && z.ring.n < z.ring.max && z.cells.has(u.cell));
const RING_LOW = 0.35;
/**
 * 뒤집힘 저주 (P-FLIP, 46 5장): 걸려 있는 동안 체력 50% 위로는 힐하지 않고 (끝나면 낮아짐), 40% 아래는 두면 뒤집혀 오르니 힐하지 않음.
 * 25% 아래는 쓰러질 수 있어 다시 힐함
 */
const flipWait = (u: Unit, _d: Debuff) => { const r = u.hp / u.max; return r > 0.5 || (r < 0.4 && r > 0.25); };
/** 지금 채울 수 있는 끝 (치유 상한 P-CAP이면 상한) 기준 체력 비율 */
const pctOf = (u: Unit) => u.hp / healTop(u);
/** 어둠물에 잠긴 사람을 이만큼 높게 봄 (가장 낮은 사람 고르기) */
const TIDE_BIAS = 0.06;
/** 과부하 표식에 힐을 넣어도 되는 모자란 양 (힐 한 번 크기쯤, 레벨 배율 전) */
const OVER_GAP = 250;
/** 힐 크기 단위: 레벨 배율 × 치유 배율 (34 1-6). 판단 기준의 회복량 숫자(스킬 표의 amt)에 곱함 */
const healUnit = (f: Fight) => f.power * f.R.heal;
/** 시전 또는 채널에 걸리는 초 (진동 판단) */
const busy = (f: Fight, k: SkillKey) => castOf(f, k) || SKILLS[k].channel || 0;
/** 진동 (P-QUAKE): 다음 울림까지 남은 초 (예고 중이거나 곧 예고할 진동 기술). 없으면 Infinity */
function calmOf(f: Fight): number {
  let t = Infinity;
  for (const x of f.tels) if (x.skill.quake) t = Math.min(t, x.impact - f.t);
  for (const s of f.skills) if (s.quake && s.active(f)) t = Math.min(t, s.next + s.cast - f.t);
  return t - 0.2;
}
/** 이 스킬을 지금 시작해도 되는지: 진동으로 잠기지 않았고, 다음 진동 전에 시전이 끝남 */
const calmFor = (f: Fight, k: SkillKey, calm: number) => !f.lock[k] && busy(f, k) < calm;
/** 녹는 보호막 (P-MELT, 51 5장): 열기 동안 외부 생존기는 맞기 MELT_EXT초 안에만 (일찍 걸면 녹아서 맞기 전에 끝남) */
const meltWait = (f: Fight, impact: number) => !!f.melt && f.t < f.melt.until && impact - f.t > MELT_EXT;
const MELT_EXT = 1.5;
/** 신기루 (P-MIRAGE, 54 5장): 가짜가 아직 안 걷힌 예고 (진짜 · 가짜 모두). 걷히기 전에는 어느 쪽인지 모르니 생존기 · 큰 힐을 아낌 */
const veiled = (f: Fight, t: Telegraph) => t.veil != null && f.t < t.veil;
/** 모래시계 (P-GLASS, 54 5장) 창 안에서 다시 채울 체력 선: 광역 예고가 떠 있으면 조금 위 (이번 광역에 쓰러질 사람) */
const glassLow = (f: Fight) => (f.tels.some(t => t.kind === 'aoe') ? 0.4 : 0.3);
/** 끊기 ✋ 능력이 있는 파티원 (반격 틈 P-COUNTER) */
const cutter = (u: Unit) => !!u.ab && ABILITIES[u.ab.key]?.fx.e === 'interrupt';

/** 이번 판단에서 보는 기믹 신호 */
interface Gim {
  /** 차례 (P-ORDER): 다음 번호. 위급한 사람이 없으면 바로 즉시 단일 힐 */
  order: Unit | null;
  /** 탱커처럼 계속 맞는 사람: 끌려와 평타를 나눠 맞음 (P-PULL), 쫄이 때림 (P-ADD 5인), 갇힘 (P-JAIL), 주시로 보스가 나를 노림 (P-AGGRO), 5인 대신 맞기 (달군 쇠) → 지속 힐을 탱커처럼 */
  hit: Unit[];
  /** 곧 크게 맞을 사람: 자폭 쫄이 두 칸 안 (P-FIXATE), 큰 쫄 강타 예고 (P-ELITE), 받침에 들어감 (P-TOWER) → 버스터처럼 미리 가득 */
  pre: Unit | null;
  /** 체력 선 (P-WOUND 쇠약 · P-FULL 완치 표식 · P-STAGGER 무력화 중 딜 선): 선 아래라 채우면 되는 사람, 모자란 양이 적은 사람부터 */
  cure: Unit | null;
  /** 곧 모두가 맞음: 폭탄이 3초 안에 터짐 (P-BOMB), 쓰러질 때 파열을 거는 쫄 떼가 거의 다 잡힘 (P-SWARM·P-BURST) → 광역 예고처럼 지속 힐을 미리 */
  aoe: boolean;
  /** 마나·치유를 아낌: 보호막 수정 (P-PYLON)이 서 있음 (깨는 동안 광폭 시계가 흐름), 주시 게이지가 거의 참 (P-AGGRO, 넘친 치유 줄이기) */
  save: boolean;
  /** 판에 적이 있음 (P-ADD): 딜러가 일점사로 빨리 잡아야 하니 딜러의 딜 0 디버프(침묵·얼림)를 먼저 지움 */
  adds: boolean;
  /** 헤매는 영혼 (P-SOUL): 시간이 가장 적게 남은 영혼 칸. 위급한 사람이 없으면 해제 또는 단일 힐을 영혼에 */
  soul: Unit | null;
  /** 생명 사슬 균형형 (P-LINK): 두 사람 체력 비율 차이가 끊기는 선의 절반을 넘으면 낮은 쪽. near = 3/4을 넘어 곧 끊어짐 */
  link: { u: Unit; near: boolean } | null;
  /** 넘치는 빛 그릇 (P-OVER): 넘친 치유가 보호막이 되니 가득 찬 사람에게도 채우기 힐 */
  spill: boolean;
  /** 마력 역류 (P-RECOIL)가 나에게: 스킬마다 중첩이 쌓이니 큰 힐 몇 번만 (지속 힐 미리 깔기·채우기 힐을 줄임) */
  few: boolean;
  /** 진동 (P-QUAKE): 다음 울림까지 남은 초. 이보다 긴 시전은 시작하지 않음 (끊기고 잠김) */
  calm: number;
  /** 반격 틈 (P-COUNTER) 기술이 있음: 끊기 능력자의 딜 0 디버프를 먼저 지움 */
  counter: boolean;
  /**
   * 지금 지우지 않을 디버프: 옮겨붙음 (P-JUMP)인데 이웃 칸에 아군이 있음 (지우면 옮겨붙어 더 세짐, 혼자일 때 지움),
   * 뒤집힘 저주 (P-FLIP)인데 체력이 낮음 (두면 뒤집혀 오름), 넘어가는 포자 (P-PASS)인데 넘길 때가 아님
   */
  hold: Set<Debuff>;
  /** 큰 피해 예고 (광역 · 버스터)가 곧 맞음: 치유 상한 (P-CAP)을 먼저 지움 */
  big: boolean;
  /** 신기루 (P-MIRAGE): 아직 안 걷힌 예고에 찍힌 사람 (진짜인지 모름) → 지속 힐만 미리 */
  veil: Unit[];
  /** 모래시계 (P-GLASS): 뒤집기 예고 중 (기록될 체력을 채움) · 창 안 (넣은 힐이 사라지니 쓰러질 사람 · 남는 일만) */
  glassFill: boolean;
  inGlass: boolean;
  /** 띄워 올리기 (P-LIFT, 56 5장): 예고에 찍힌 사람. 떠오르면 새 힐 · 해제가 안 닿으니 예고 동안 해제 → 지속 힐을 먼저 */
  lift: Unit[];
  /** 띄우기 예고에 찍힌 사람 가운데 지울 것이 있는 사람 (힐하면 손해인 사람도: 거꾸로 주문은 떠 있는 동안 뒤집히니 예고 동안 지움, 56 3-2) */
  liftClean: Unit[];
  /** 연쇄 번개 (P-CHAIN): 번개 구름 (내려오며 번개면 떠 있는 사람 자리) 옆에서 피뢰침 선 (90%) 아래인 가장 낮은 사람. soon = 맞기까지 남은 초 */
  chain: { u: Unit; soon: number } | null;
  /** 떠 있는 사람이 낮으면 그 사람과 나눔 사슬로 묶인 짝 (짝에게 넣은 힐의 반이 하늘까지 감) */
  mate: Unit | null;
  /** 어둠물 밀물 (P-TIDE, 59 5장): 예고 동안 잠길 칸에 있는 사람 가운데 90% 아래인 가장 낮은 사람 (잠기면 힐이 반만 드니 미리) */
  tide: Unit | null;
  /** 빌린 생명 (P-DEBT, 59 5장): 빚진 사람 (빚이 가장 큰). due = 빚이 체력의 60%를 넘거나 거둬 가기 4초 전 → 넘친 치유로 갚기 */
  debt: { u: Unit; due: boolean } | null;
}

function gim(f: Fight): Gim {
  let order: Unit | null = null;
  if (f.order) {
    // 신기루 숫자 (54 4-1): 다음 번호가 둘로 보이면 걷힐 때까지 기다림
    const o = f.order, wait = !!o.fake && f.t < o.fake.until && o.i === o.fake.num;
    const u = unitById(f, o.ids[o.i]);
    if (!wait && u && u.alive && !off(f, u)) order = u;
  }
  const adds = f.mobs.filter(m => m.alive && m.add);
  const watched = !!f.watch && f.t < f.watch.until;
  const hit = f.party.filter(u => u.alive && u.role !== 'tank' && !off(f, u)
    && (u.pulled || u.debuffs.some(d => d.jail) || (f.sub?.id === u.id && f.t < f.sub.until) || adds.some(m => m.add!.dmg > 0 && m.add!.on === u.id) || (u.me && watched)));
  let pre: Unit | null = null;
  for (const m of adds) {
    const a = m.add!, u = unitById(f, a.on);
    if (!u || !u.alive || off(f, u) || u.hp >= healTop(u) * 0.95) continue;
    if ((a.job?.p === 'fixate' && hexDist(f.cells[a.cell!], cellOf(f, u)) <= 2) || (a.job?.p === 'smash' && a.warned)) { pre = u; break; }
  }
  if (!pre) pre = f.party.filter(u => u.alive && u.padUntil != null && u.padUntil > f.t && !off(f, u) && u.hp < healTop(u) * 0.95).sort((a, b) => a.hp / a.max - b.hp / b.max)[0] ?? null;
  // 무력화 중에는 선보다 조금 위까지 (선에 딱 걸치면 한 대에 다시 내려감)
  const st = f.stagger;
  const gap = (u: Unit) => Math.max(st && !u.me ? (st.hp + 0.03) * u.max - u.hp : -Infinity, ...u.debuffs.filter(d => d.cureAt != null).map(d => d.cureAt! * u.max - u.hp));
  const cure = f.party.filter(u => u.alive && !off(f, u) && gap(u) > 0).sort((a, b) => gap(a) - gap(b))[0] ?? null;
  let link: Gim['link'] = null;
  for (const l of f.links) {
    const a = unitById(f, l.a), b = unitById(f, l.b);
    if (l.kind !== 'balance' || !a?.alive || !b?.alive) continue;
    const d = a.hp / a.max - b.hp / b.max, lo = d < 0 ? a : b, near = Math.abs(d) > l.gap * 0.75;
    if (Math.abs(d) > l.gap * 0.5 && !off(f, lo) && (!link || (near && !link.near))) link = { u: lo, near };
  }
  const hold = new Set<Debuff>();
  for (const u of f.party) for (const d of u.debuffs) {
    if (d.end?.p === 'jump' && d.end.on !== 'quake' && u.alive && f.party.some(v => v !== u && v.alive && hexDist(cellOf(f, v), cellOf(f, u)) === 1)) hold.add(d);
    if (d.end?.p === 'flip' && u.hp < u.max * 0.45) hold.add(d);
    // 넘어가는 포자 (P-PASS, 48 5장): 붙은 사람이 50% 아래이고 70% 위인 다른 사람이 있을 때만 지워 넘김. 아니면 힐로 막을 녹임
    if (d.end?.p === 'pass' && !(u.hp < u.max * 0.5 && f.party.some(v => v !== u && v.alive && v.hp > v.max * 0.7))) hold.add(d);
  }
  // 부풀기 (P-SWELL): 못 지운 채 곧 터지면 본인을 미리 가득
  if (!pre) pre = f.party.find(u => u.alive && !off(f, u) && u.hp < healTop(u) * 0.95 && u.debuffs.some(d => d.swell && d.left < 3)) ?? null;
  // 신기루가 걷힌 진짜 예고: 찍힌 사람을 바로 가득 (걷히기 전에는 지속 힐만)
  const veil: Unit[] = [];
  for (const t of f.tels) {
    if (t.veil == null || t.kind !== 'buster') continue;
    const us = t.units.map(id => unitById(f, id)).filter((u): u is Unit => !!u && u.alive && !off(f, u));
    if (veiled(f, t)) veil.push(...us);
    else if (!pre) pre = us.find(u => u.hp < healTop(u) * 0.95) ?? null;
  }
  return {
    order, hit, pre, cure,
    aoe: adds.some(m => (m.add!.job?.p === 'bomb' && m.add!.jobAt! - f.t < 3) || (m.add!.down?.p === 'burst' && m.hp < m.max * 0.25)),
    save: adds.some(m => m.add!.job?.p === 'pylon') || (!!f.watch && !watched && f.watch.fill > f.watch.max * 0.8),
    adds: adds.length > 0,
    soul: f.souls.filter(u => u.alive).sort((a, b) => a.soul!.until - b.soul!.until)[0] ?? null,
    link,
    spill: !!f.vessel && f.t < f.vessel.until,
    few: f.me.debuffs.some(d => d.count),
    calm: calmOf(f),
    counter: f.abOn && f.skills.some(s => s.stunOnCut),
    hold,
    big: f.tels.some(t => (t.kind === 'aoe' || t.kind === 'buster') && t.impact - f.t < 3.5),
    veil,
    glassFill: f.tels.some(t => t.skill.glass),
    inGlass: f.glass.some(x => x.until - f.t > 0.3),
    lift: liftUnits(f).filter(u => !off(f, u)),
    liftClean: liftUnits(f).filter(u => u.debuffs.some(d => cleanable(f, d) && !hold.has(d))),
    chain: chainNear(f),
    mate: liftMate(f),
    tide: tideFill(f),
    debt: debtOf(f),
  };
}

/** 어둠물 밀물 대비 (59 5장 자동 힐러 규칙): 예고 동안 잠길 칸 (움직이는 중이면 가는 칸)에 있는 사람 가운데 90% 아래인 가장 낮은 사람 */
function tideFill(f: Fight): Unit | null {
  let best: Unit | null = null;
  for (const t of f.tels) if (t.skill.tide && !veiled(f, t)) for (const v of living(f)) {
    if (!t.cells.has(v.moving ? v.moving.to : v.cell) || off(f, v) || v.hp >= healTop(v) * 0.9) continue;
    if (!best || pctOf(v) < pctOf(best)) best = v;
  }
  // 물로 끌어내림 (59 4-3 휘감이): 예고에 찍힌 사람도 끌려가면 힐이 반만 드니 미리
  for (const t of f.tels) if (t.skill.drag) for (const id of t.units) {
    const v = unitById(f, id);
    if (!v?.alive || off(f, v) || v.hp >= healTop(v) * 0.9) continue;
    if (!best || pctOf(v) < pctOf(best)) best = v;
  }
  return best;
}

/** 빌린 생명 (59 5장 자동 힐러 규칙): 빚이 가장 큰 사람. 갇힌 사람은 빚이 멈춰 있으니 뺌 */
function debtOf(f: Fight): Gim['debt'] {
  let best: Gim['debt'] = null, most = 0;
  for (const v of living(f)) {
    const d = v.debuffs.length ? v.debuffs.find(x => (x.debtLeft ?? 0) > 1e-6) : undefined;
    if (!d || off(f, v) || v.debuffs.some(x => x.jail)) continue;
    const due = d.debtLeft! > v.hp * 0.6 || d.left < 4;
    if (!best || (due && !best.due) || (due === best.due && d.debtLeft! > most)) { best = { u: v, due }; most = d.debtLeft!; }
  }
  return best;
}

/** 띄우기 예고에 찍힌 사람 (살아 있고 아직 안 떴음) */
const liftUnits = (f: Fight) => f.tels.filter(t => t.skill.lift && !veiled(f, t)).flatMap(t => t.units.map(id => unitById(f, id)).filter((u): u is Unit => !!u && u.alive && !u.lift));

/** 연쇄 번개 대비 (56 5장 자동 힐러 규칙): 번개가 떨어질 칸 (예고 대상 · 내려오며 번개를 달고 떠 있는 사람) 이웃 가운데 90% 아래인 가장 낮은 사람 */
function chainNear(f: Fight): Gim['chain'] {
  const spots: { c: number; at: number }[] = [];
  for (const t of f.tels) if (t.skill.chain && !veiled(f, t)) for (const id of t.units) { const u = unitById(f, id); if (u?.alive) spots.push({ c: u.cell, at: t.impact }); }
  for (const u of f.party) if (u.alive && u.lift?.chain && !u.lift.land) spots.push({ c: u.cell, at: u.lift.until });
  let best: Gim['chain'] = null;
  for (const sp of spots) {
    const c0 = f.cells[sp.c];
    for (const v of living(f)) {
      if (v.cell === sp.c || hexDist(cellOf(f, v), c0) !== 1 || off(f, v) || v.hp >= v.max * ROD_HP) continue;
      if (!best || v.hp / v.max < best.u.hp / best.u.max) best = { u: v, soon: sp.at - f.t };
    }
  }
  return best;
}

/** 떠 있는 사람이 60% 아래면 나눔 사슬 짝 (짝을 힐하면 반이 하늘까지) */
function liftMate(f: Fight): Unit | null {
  for (const l of f.links) {
    if (l.kind !== 'share') continue;
    const a = unitById(f, l.a), b = unitById(f, l.b);
    if (!a?.alive || !b?.alive) continue;
    const up = a.lift ? a : b.lift ? b : null, mate = up === a ? b : a;
    if (up && !mate.lift && up.hp < up.max * LIFT_LOW && !off(f, mate)) return mate;
  }
  return null;
}
const LIFT_LOW = 0.6;
/** 이 직업이 지울 수 있는 디버프 (해제 불가 · 함정 빼고) */
const cleanable = (f: Fight, d: Debuff) => !d.trap && !d.lock && (f.hero === 'priest' ? !!DISPELLABLE[d.type] : HEROES[f.hero].dispel.includes(d.type));

/** 채우기 힐을 넣는 체력 선: 그릇이 있으면 가득 찬 사람에게도 (넘치게), 역류 중이면 낮게, 아낄 때 0.7 */
const topUp = (f: Fight, g: Gim, base: number) => (g.spill && f.mana > 30 ? 1.01 : g.glassFill && f.mana > 15 ? 0.97 : g.few ? 0.6 : g.save ? 0.7 : base);
/**
 * 모래시계 창 안 (54 5장): 넣은 힐이 되돌아가니 남는 일만. 해제 → 체력 선 (완치 표식) → 치유 흡수 막 벗기기 → 쓰러질 사람.
 * one(u, hurry) = 단일 힐 하나 (썼으면 true), cleanse() = 해제 하나. 창 안이면 무엇을 했든 true (평소 판단을 건너뜀)
 */
function glassWindow(f: Fight, g: Gim, live: Unit[], one: (u: Unit, hurry: boolean) => boolean, cleanse: () => boolean): boolean {
  if (!g.inGlass) return false;
  if (cleanse()) return true;
  if (g.cure && one(g.cure, false)) return true;
  const bandaged = live.filter(u => u.debuffs.some(d => (d.absorbLeft ?? 0) > 0)).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
  if (bandaged && f.mana > 10 && one(bandaged, false)) return true;
  const low = live.filter(u => pctOf(u) < glassLow(f)).sort((a, b) => pctOf(a) - pctOf(b))[0];
  if (low) one(low, true);
  return true;
}

/**
 * 해제 순서 (35 3-D·3-I·3장 표): 뒤집힌 축복(힐을 막음)·나의 마력 역류(일찍 지울수록 적게 터짐) → 매혹·마나 갈취 표식·메아리 (진동에 옮겨붙음),
 * 판에 적이 있으면 딜러의 딜 0, 반격 틈이 있으면 끊기 능력자의 딜 0 → 그 밖. 같은 순위는 넘겨받은 순서 그대로
 */
function byDispel(g: Gim, cands: Unit[], ok: (d: Debuff) => boolean): Unit[] {
  const rank = (u: Unit) => dispelRank(g, u, ok);
  return cands.map((u, i) => ({ u, i, r: rank(u) })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.u);
}
/** 해제 순서 (byDispel): 0 · 1 = 먼저 지울 디버프, 2 = 보통 디버프 */
function dispelRank(g: Gim, u: Unit, ok: (d: Debuff) => boolean): number {
  const ds = u.debuffs.filter(ok);
  // 부풀기는 중첩이 쌓이기 전에, 치유 상한은 큰 피해 예고가 떴을 때 · 완치 표식이 같이 있을 때 (상한부터 지워야 표식이 사라짐, 56 4-3), 뒤집힘은 체력이 높을 때 (46 5장)
  const full = u.debuffs.some(d => d.cureAt != null && d.cureAt >= 1);
  if (ds.some(d => d.invert || d.count || d.swell || (d.cap != null && (g.big || full)) || (d.end?.p === 'flip' && u.hp > u.max * 0.5) || d.end?.p === 'pass')) return 0;
  if (ds.some(d => d.charm || d.drain || (d.end?.p === 'jump' && d.end.on === 'quake'))) return 1;
  if (ds.some(d => d.noDps) && ((g.adds && (u.role === 'melee' || u.role === 'ranged')) || (g.counter && cutter(u)))) return 1;
  return 2;
}
/** 자동 힐러가 마지막으로 해제한 때 (함정이 아닌 해제 수 f.stats.dispels가 바뀐 시각) */
const lastDispel = new WeakMap<Fight, { n: number; t: number }>();
const noteDispel = (f: Fight) => {
  const l = lastDispel.get(f);
  if (!l || l.n !== f.stats.dispels) lastDispel.set(f, { n: f.stats.dispels, t: l ? f.t : -Infinity });
};
/** 보통 디버프를 지우는 간격: 해제 재사용 대기를 8 → 4초로 줄이기 전 (2026-10-12) */
const DISPEL_PACE = 8;
/**
 * 해제 4초 (2026-10-12 Lim 「해제는 쿨타임을 짧게」): 보통 디버프 (dispelRank 2)는 예전처럼 8초에 1번만 지워 마나 · GCD를 힐에 남김
 * (보통 디버프까지 4초마다 지우면 사제 마나가 모자람: 재사용 3초로 다 지울 때 레이드 악몽 사제 클리어 74 → 68%, 무너진 망루 보통 20판 14승으로 기준 16승 아래).
 * 먼저 지울 디버프 (0 · 1)는 재사용이 돌면 바로. 그래서 168곳 자동 밸런스 기준은 그대로
 */
function paced(f: Fight, g: Gim, u: Unit, ok: (d: Debuff) => boolean): boolean {
  if (f.cfg.proto || dispelRank(g, u, ok) < 2) return true;
  const l = lastDispel.get(f);
  return !l || f.t - l.t >= DISPEL_PACE - 1e-9;
}

/** 시전 중 대상에게 뒤집힌 축복이 걸리면 그 힐을 취소 (사람이 다른 칸을 눌러 끊는 것과 같음, GCD는 돌려받음) */
function dropInverted(f: Fight): void {
  const bad = (uid: number | null) => uid != null && !!unitById(f, uid)?.debuffs.some(d => d.invert);
  if (f.cast && bad(f.cast.uid)) { f.cast = null; f.stats.cancels++; f.gcd = 0; }
  if (f.queued && bad(f.queued.uid)) f.queued = null;
}

/** 자동 힐러 (밸런스 시뮬레이션·구경 모드용, sim decide() 이식). 아직 안 배운 스킬은 건너뜀 */
export function autoHealer(f: Fight): void {
  dropInverted(f);
  noteDispel(f);
  autoTalents(f);
  if (f.hero === 'druid') { autoDruid(f); return; }
  if (f.hero === 'paladin') { autoPaladin(f); return; }
  if (f.hero === 'shaman') { autoShaman(f); return; }
  if (f.hero === 'monk') { autoMonk(f); return; }
  if (f.hero === 'astrologer') { autoAstro(f); return; }
  if (f.hero === 'warder') { autoWarder(f); return; }
  if (f.cast || f.channel > 0 || f.gcd > 0 || f.queued) return;
  const all = living(f), live = all.filter(u => !off(f, u)), g = gim(f);
  if (!live.length) return;
  const pct = pctOf;
  const low = lowest(f, live, pct);
  const aoeSoon = g.aoe || f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 3.5);
  const cellIdx = (u: Unit) => (u.moving ? u.moving.from : u.cell);
  /** 배웠고 진동에 안 걸림 (잠김 · 울리기 전에 시전이 안 끝남) */
  const can = (k: SkillKey) => knows(f, k) && calmFor(f, k, g.calm);
  /** 큰 단일 힐: 급하거나 치유를 못 쓰면 순간 치유 */
  const big = (hurry: boolean): SkillKey | null => (hurry || !can('heal') ? (can('flash') ? 'flash' : null) : 'heal');
  const purifyOk = can('purify') && (f.cd.purify ?? 0) <= 0 && f.mana >= 4;
  const purifyNow = (): boolean => {
    if (!purifyOk) return false;
    const ok = (d: Debuff) => !!DISPELLABLE[d.type] && !d.trap && !d.lock && !g.hold.has(d);
    const c = byDispel(g, all.filter(u => u.debuffs.some(ok)), ok);
    if (!c.length || !paced(f, g, c[0], ok)) return false;
    use(f, 'purify', cellIdx(c[0]));
    return true;
  };
  // 모래시계 창 안 (54 5장): 남는 일만
  if (glassWindow(f, g, live, (u, hurry) => { const k = big(hurry); return !!k && f.mana > 3 && use(f, k, cellIdx(u)).ok; }, purifyNow)) return;
  // 찬가는 모두를 채우니 힐하면 손해인 사람이 있으면 안 씀
  if (can('hymn') && (f.cd.hymn ?? 0) <= 0 && live.length === all.length && live.filter(u => pct(u) < 0.5).length >= Math.max(2, Math.floor(live.length / 2)) && f.mana >= 15) { use(f, 'hymn', 0); return; }
  for (const t of f.tels) if (t.kind === 'buster' && !meltWait(f, t.impact) && !veiled(f, t) && knows(f, 'guardian') && (f.cd.guardian ?? 0) <= 0 && f.mana >= 2) {
    const tk = unitById(f, t.units[0]);
    if (tk && tk.alive && pct(tk) < 0.75) { use(f, 'guardian', cellIdx(tk)); return; }
  }
  const bs = busterShort(f), bk = bs && big(bs.soon);
  if (bs && bk && !off(f, bs.u) && f.mana > 6) { use(f, bk, cellIdx(bs.u)); return; }
  if (g.pre && f.mana > 6 && can('flash')) { use(f, 'flash', cellIdx(g.pre)); return; }
  // 띄워 올리기: 예고 동안 해제 → 소생 (떠 있는 동안은 미리 건 지속 힐만 닿음)
  { const d = g.liftClean[0]; if (d && purifyOk) { use(f, 'purify', cellIdx(d)); return; } }
  { const v = g.lift.find(u => u.hot <= 0); if (v && can('renew') && f.mana >= SKILLS.renew.cost) { use(f, 'renew', cellIdx(v)); return; } }
  // 연쇄 번개: 번개 구름 옆 가장 낮은 사람을 90% 위로 (피뢰침)
  if (g.chain && f.mana > 4) { const k = big(g.chain.soon < castOf(f, 'heal') + 0.3); if (k) { use(f, k, cellIdx(g.chain.u)); return; } }
  if (g.mate && f.mana > 4) { const k = big(false); if (k) { use(f, k, cellIdx(g.mate)); return; } }
  // 어둠물: 잠길 줄 사람을 예고 동안 채움 · 빌린 생명: 빚이 크거나 곧 거둬 가면 (위급한 사람이 없으면 언제든) 그 사람에게 힐해서 갚기
  if (g.tide && f.mana > 4) { const k = big(pct(g.tide) < 0.5); if (k) { use(f, k, cellIdx(g.tide)); return; } }
  if (g.debt && (g.debt.due || pct(low) > 0.6) && f.mana > 6) { const k = big(g.debt.due && g.debt.u.debuffs.some(d => (d.debtLeft ?? 0) > 0 && d.left < castOf(f, 'heal') + 0.5)); if (k) { use(f, k, cellIdx(g.debt.u)); return; } }
  // 차례: 위급한 사람이 없으면 다음 번호에 즉시 단일 힐 (소생, 없으면 순간 치유)
  if (g.order && pct(low) > 0.3) {
    const k = can('renew') && f.mana >= SKILLS.renew.cost ? 'renew' : can('flash') && f.mana >= SKILLS.flash.cost ? 'flash' : null;
    if (k) { use(f, k, cellIdx(g.order)); return; }
  }
  // 생명 사슬이 곧 끊어지면 낮은 쪽부터
  if (g.link?.near && f.mana > 6) { const k = big(pct(g.link.u) < 0.5); if (k) { use(f, k, cellIdx(g.link.u)); return; } }
  // 신기루가 안 걷힌 예고에 찍힌 사람: 지속 힐만 미리 (진짜인지 모름)
  if (g.veil.length && f.mana > 15 && can('renew')) { const v = g.veil.find(u => u.hot <= 0); if (v) { use(f, 'renew', cellIdx(v)); return; } }
  const thrifty = f.mana < 25 || g.save; // 마나가 바닥나거나 아껴야 하면 무료 성언을 아끼지 않는다
  if (f.g.p >= 100 && pct(low) < (thrifty ? 0.7 : 0.45)) { use(f, 'serenity', cellIdx(low)); return; }
  // 광역 힐 판단 기준은 힐 크기에 맞춤 (레벨 배율 · 치유 배율, 07 4장 · 34 1-6). 힐하면 손해인 사람이 범위에 들면 그 자리는 안 씀
  const hp = healUnit(f);
  // 기원 범위는 반경 1로만 셈: 넓은 원 (반경 2)까지 세면 기원을 더 자주 써서 마나가 먼저 바닥남 (2026-10-14 168곳 비교: 5인 악몽 62 → 58%)
  const { best, score } = clusterOf(f, live, all, 180, 1);
  if (pct(low) < 0.35 && f.mana > 8 && can('flash')) { use(f, 'flash', cellIdx(low)); return; }
  if (score > aoeBar(f, 600, 180, 1) * hp && f.mana > 12 && can('poh')) { use(f, 'poh', cellIdx(best!)); return; }
  if (purifyNow()) return;
  // 체력 선: 채우면 풀리는 사람을 선 위로
  if (g.cure && pct(low) > 0.4 && f.mana > 3) { const k = big(pct(g.cure) < 0.5); if (k) { use(f, k, cellIdx(g.cure)); return; } }
  // 헤매는 영혼: 위급한 사람이 없으면 해제로 바로, 아니면 소생을 깔고 단일 힐 (시간이 모자라면 순간 치유)
  if (g.soul && pct(low) > 0.5 && f.mana > 10) {
    const sl = g.soul, left = sl.soul!.until - f.t;
    if (purifyOk && canTarget(f, 'purify', sl.cell).ok) { use(f, 'purify', sl.cell); return; }
    if (sl.hot <= 0 && can('renew')) { use(f, 'renew', sl.cell); return; }
    const k = big(left < castOf(f, 'heal') + 1);
    if (k) { use(f, k, sl.cell); return; }
  }
  if (g.link && pct(low) > 0.4 && f.mana > 3) { const k = big(false); if (k) { use(f, k, cellIdx(g.link.u)); return; } }
  // 역류 중에는 지속 힐도 중첩이 되니 탱커가 꽤 다쳤을 때만
  const tanks = live.filter(u => u.role === 'tank' && u.hot <= 1 && (!g.few || pct(u) < 0.7)).concat(g.hit.filter(u => u.hot <= 1));
  if (tanks.length && f.mana > 5 && can('renew')) { use(f, 'renew', cellIdx(tanks[0])); return; }
  if (aoeSoon && !g.few && f.mana > 20 && can('renew')) { const n = live.find(u => u.hot <= 0); if (n) { use(f, 'renew', cellIdx(n)); return; } }
  // 빛의 전이 (8번째 칸): 채울 사람이 없을 때 재사용마다, 보스가 때리는 사람이 다치기 시작하면 그 사람에게 (남은 회복이 절반 넘게 남은 빛은 안 덮어씀, 마나를 아낄 때는 안 씀).
  // 채우기 힐보다 먼저 쓰면 보통 클리어율이 떨어짐 (사제 모든 장소 × 20판: 빛의 전이 없음 95.3%, 먼저 쓰면 93.6%, 채울 사람이 없을 때만 95.0%).
  // 너프 (3번 · 바로 옆 칸, 2026-10-11) 뒤 168곳 × 20판: 너프 전 보통 95.9 · 어려움 73.8% → 95.9 · 72.9% (빛의 전이 없음 95.8 · 72.8).
  // 마나 50% 아래에선 안 씀: 긴 보스전 (얼음 서고 대학자)에서 마나가 바닥나 힐러가 쓰러지던 판이 있었음. 프로토타입에 없던 스킬이라 일치 테스트 (proto)에선 안 씀
  const tk = aggroTarget(f);
  if (!f.cfg.proto && tk && !off(f, tk) && pct(tk) < 0.95 && pct(low) >= topUp(f, g, 0.85) && !g.save && can('relay') && (f.cd.relay ?? 0) <= 0 && f.mana >= 50 && (!f.relay || f.relay.left <= Math.floor(RELAY.hops / 2))) {
    if (use(f, 'relay', cellIdx(tk)).ok) return;
  }
  if (pct(low) < topUp(f, g, 0.85) && f.mana > 3) {
    if (can('heal')) use(f, 'heal', cellIdx(low));
    else if (low.hot <= 0 && can('renew')) use(f, 'renew', cellIdx(low)); // 진동 직전: 시전 대신 즉시 지속 힐
  }
}

/**
 * 보조 버튼 특성 (GCD 밖). 사제: 여럿이 다치면 정점·흩빛, 위급하면 기적, 도망가는 파티원이 있으면 뒤쪽 빈 칸에 쉼터.
 * 드루이드 (77): 여럿이 다치거나 광역이 곧 오면 봄비 · 숲의 기억, 누가 아주 낮고 거둘 새싹이 넉넉하면 고목.
 * 성기사 (77): 여럿이 다치거나 위급하면 가득 찬 빛 (힘이 모자랄 때), 여럿이 다치면 새벽의 맹세
 */
function autoTalents(f: Fight): void {
  const act = f.tx.act;
  if (!Object.keys(act).length) return;
  const live = living(f);
  if (!live.length) return;
  const pct = (u: Unit) => u.hp / u.max;
  const hurt = live.filter(u => pct(u) < 0.6).length;
  const many = hurt >= Math.max(2, Math.ceil(live.length * 0.3));
  const low = live.reduce((a, b) => (pct(b) < pct(a) ? b : a));
  if (act.miracle && talentReady(f, 'miracle').ok && f.g.p < 100 && (many || live.some(u => pct(u) < 0.3))) useTalent(f, 'miracle');
  if (act.zenith && many && talentReady(f, 'zenith').ok) useTalent(f, 'zenith');
  if (act.scatter && many && talentReady(f, 'scatter').ok) useTalent(f, 'scatter');
  if (act.shelter && talentReady(f, 'shelter').ok && live.some(u => u.p.flee && pct(u) < u.p.flee + 0.1)) {
    const c = f.cells.filter(x => !x.unit && !dangerAt(f, x.i)).sort((a, b) => b.row - a.row)[0];
    if (c) useTalent(f, 'shelter', c.i);
  }
  const aoeSoon = f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 4);
  if (act.springRain && (many || aoeSoon) && live.filter(u => !u.hots.some(h => h.key === 'sprout')).length >= Math.max(2, Math.ceil(live.length * 0.4)) && talentReady(f, 'springRain').ok) useTalent(f, 'springRain');
  if (act.forestMemory && (many || aoeSoon) && talentReady(f, 'forestMemory').ok) useTalent(f, 'forestMemory');
  if (act.oldTree && pct(low) < 0.3 && talentReady(f, 'oldTree').ok) {
    let sum = 0;
    for (const v of live) if (v !== low) for (const h of v.hots) if (h.key === 'sprout') sum += h.rest;
    if (sum * 2 * healUnit(f) >= low.max * 0.3) useTalent(f, 'oldTree');
  }
  if (act.resolveFill && f.power3 < 2 && (many || pct(low) < 0.3) && talentReady(f, 'resolveFill').ok) useTalent(f, 'resolveFill');
  if (act.dawnVow && many && talentReady(f, 'dawnVow').ok) useTalent(f, 'dawnVow');
  // 주술사 (79 2-7): 여럿이 다치면 물의 정령, 여럿이 다쳤고 모인 칸이 있으면 바다의 자리, 토템 범위에 아무도 없으면 토템 부르기
  if (act.waterSpirit && many && talentReady(f, 'waterSpirit').ok) useTalent(f, 'waterSpirit');
  if ((act.seaSeat && (many || aoeSoon) && talentReady(f, 'seaSeat').ok) || (act.totemCall && talentReady(f, 'totemCall').ok)) {
    const r = act.seaSeat ? TX.seaSeat.range : 1;
    let best = -1, bn = 0;
    for (const c of f.cells) {
      if (c.block || (act.seaSeat && c.unit) || dangerAt(f, c.i) || totemBreaks(f, c.i)) continue;
      const n = live.filter(v => hexDist(cellOf(f, v), c) <= r).length;
      if (n > bn) { bn = n; best = c.i; }
    }
    if (act.seaSeat && best >= 0 && bn >= 3) useTalent(f, 'seaSeat', best);
    else if (act.totemCall && best >= 0 && bn >= 3 && f.totems.some(t => (t.kind === 'spring' || t.kind === 'earth') && live.filter(v => hexDist(cellOf(f, v), f.cells[t.cell]) <= 1).length <= 1)) useTalent(f, 'totemCall', best);
  }
  // 수도사 (79 3-7): 여럿이 다치면 천 개의 손 · 안개 폭풍 (안개가 3명 이상), 모인 칸에 안개 샘 · 기 폭발 (리듬 3 이상)
  if (act.thousandHands && many && talentReady(f, 'thousandHands').ok) useTalent(f, 'thousandHands');
  if (act.mistStorm && (many || aoeSoon) && live.filter(v => v.hots.some(h => h.key === 'wanderMist')).length >= 3 && talentReady(f, 'mistStorm').ok) useTalent(f, 'mistStorm');
  if ((act.gatherMist && (many || aoeSoon) && talentReady(f, 'gatherMist').ok) || (act.chiBurst && many && f.beat >= 3 && talentReady(f, 'chiBurst').ok)) {
    const pool = !!act.gatherMist, r = pool ? 1 : TX.chiBurst.range;
    let best = -1, bn = 0;
    for (const c of f.cells) {
      if (c.block || (pool && (c.unit || totemBreaks(f, c.i) || dangerAt(f, c.i)))) continue;
      if (live.some(v => off(f, v) && hexDist(cellOf(f, v), c) <= r)) continue;
      const n = live.filter(v => hexDist(cellOf(f, v), c) <= r && pct(v) < 0.9).length;
      if (n > bn) { bn = n; best = c.i; }
    }
    if (best >= 0 && bn >= 3) useTalent(f, pool ? 'gatherMist' : 'chiBurst', best);
  }
  // 점성술사 (79 4-7): 여럿이 다치면 은하수 · 내리는 밤 (별비가 돌 때), 모인 빈 칸에 초신성
  if (act.milkyWay && many && talentReady(f, 'milkyWay').ok) useTalent(f, 'milkyWay');
  if (act.fallingNight && (many || aoeSoon) && (f.cd.starfall ?? 0) <= 0 && talentReady(f, 'fallingNight').ok) useTalent(f, 'fallingNight');
  if (act.supernova && (many || aoeSoon) && talentReady(f, 'supernova').ok) {
    let best = -1, bn = 0;
    for (const c of f.cells) {
      if (c.block || c.unit || dangerAt(f, c.i)) continue;
      if (live.some(v => off(f, v) && hexDist(cellOf(f, v), c) <= TX.supernova.range)) continue;
      const n = live.filter(v => hexDist(cellOf(f, v), c) <= TX.supernova.range && pct(v) < 0.9).length;
      if (n > bn) { bn = n; best = c.i; }
    }
    if (best >= 0 && bn >= 3) useTalent(f, 'supernova', best);
  }
  // 결계사 (79 5-7): 인장이 붙은 다친 아군이 많으면 심판의 망치 · 끝없는 심판, 모인 빈 칸에 성채
  const sealedHurt = f.hero === 'warder' ? sealTargets(f, 20).filter(v => pct(v) < 0.85).length : 0;
  if (act.judgeHammer && sealedHurt >= 3 && talentReady(f, 'judgeHammer').ok) useTalent(f, 'judgeHammer');
  if (act.endlessJudge && sealedHurt >= 3 && many && talentReady(f, 'endlessJudge').ok) useTalent(f, 'endlessJudge');
  if (act.citadel && (many || aoeSoon) && talentReady(f, 'citadel').ok) {
    let best = -1, bn = 0;
    for (const c of f.cells) {
      if (c.block || c.unit || dangerAt(f, c.i)) continue;
      const n = live.filter(v => hexDist(cellOf(f, v), c) <= TX.citadel.range).length;
      if (n > bn) { bn = n; best = c.i; }
    }
    if (best >= 0 && bn >= 3) useTalent(f, 'citadel', best);
  }
}

/**
 * 광역 힐 자리: 반경 r 안에서 모자란 체력 (한 명당 amt × 치유 단위까지)을 더한 값이 가장 큰 사람.
 * 힐하면 손해인 사람이 범위에 들면 그 자리는 안 씀
 */
function clusterOf(f: Fight, live: Unit[], all: Unit[], amt: number, r: number, top = Infinity): { best: Unit | null; score: number } {
  const cap = amt * healUnit(f);
  let best: Unit | null = null, score = 0;
  for (const c of live) {
    let bad = false;
    const got: number[] = [];
    for (const v of all) if (hexDist(cellOf(f, v), cellOf(f, c)) <= r) { if (off(f, v)) bad = true; else got.push(Math.min(cap, Math.max(0, healTop(v) - v.hp))); }
    // top: 가장 다친 몇 명에게만 들어가는 광역 (빛의 파도 4명, 73)은 그만큼만 셈
    const s = bad ? -Infinity : (top < got.length ? got.sort((a, b) => b - a).slice(0, top) : got).reduce((a, b) => a + b, 0);
    if (s > score) { best = c; score = s; }
  }
  return { best, score };
}
/**
 * 광역 힐을 쓸 점수 문턱 (치유 단위 1 기준): bar = 큰 파티에서 쓰던 값. 파티가 작아 범위에 다 들어와도 그만큼 못 모이면
 * 닿을 수 있는 사람 수 − 0.5명분으로 낮춤 (2026-10-14 직업 밸런스 검토: 3인은 3명이 다 다쳐도 기원 540 · 들꽃 480이라 600 · 500을 못 넘어 광역을 안 씀)
 */
function aoeBar(f: Fight, bar: number, amt: number, r: number): number {
  if (f.cfg.proto) return bar; // 프로토타입 일치 테스트는 옛 고정 문턱
  const reach = r >= 2 ? f.party.length : Math.min(7, f.party.length);
  return Math.min(bar, (reach - 0.5) * amt);
}

// ---------- 드루이드·성기사 자동 힐러 (25 3장의 손맛대로: 드루이드는 미리 깔고, 성기사는 모았다가 씀) ----------
interface Ctx { live: Unit[]; all: Unit[]; g: Gim; pct: (u: Unit) => number; low: Unit; idx: (u: Unit) => number; ready: (k: SkillKey) => boolean; cluster: { best: Unit | null; score: number }; busterOn: Unit | null }
/** live = 힐해도 되는 사람 (뒤집힌 축복이 걸린 사람 뺌), all = 살아 있는 모두 */
function ctx(f: Fight, amt: number, r = 1, top = Infinity): Ctx | null {
  if (f.cast || f.channel > 0 || f.gcd > 0 || f.queued) return null;
  const all = living(f), live = all.filter(u => !off(f, u));
  if (!live.length) return null;
  const pct = pctOf;
  const low = lowest(f, live, pct);
  const idx = (u: Unit) => (u.moving ? u.moving.from : u.cell);
  // 준비는 원래 마나 소모로 봄 (줄어든 소모로 보면 마나를 바닥까지 써서 성기사 초반 악몽 86 → 77%, 드루이드는 그대로. 2026-10-14 비교) = 그만큼이 여유분
  const ready = (k: SkillKey) => knows(f, k) && (f.cd[k] ?? 0) <= 0 && !f.lock[k] && f.mana >= SKILLS[k].cost;
  const { best, score } = clusterOf(f, live, all, amt, r, top);
  const bt = f.tels.find(t => t.kind === 'buster' && !meltWait(f, t.impact) && !veiled(f, t));
  const on = bt ? unitById(f, bt.units[0]) || null : null;
  return { live, all, g: gim(f), pct, low, idx, ready, cluster: { best, score }, busterOn: on && !off(f, on) ? on : null };
}
const tryUse = (f: Fight, k: SkillKey, u: Unit | null, idx: (u: Unit) => number): boolean => {
  const cell = u ? idx(u) : 0;
  if (!canTarget(f, k, cell).ok) return false;
  if (busy(f, k) > 0 && busy(f, k) >= calmOf(f)) return false; // 진동 전에 시전이 안 끝남 → 다음 후보 (즉시 스킬)
  return use(f, k, cell).ok;
};
/** 지울 디버프가 있는 파티원: 해제 순서(byDispel) 다음, 곧 터지는 것 (독창 등 남은 시간이 짧은 것)부터 */
const cleansable = (f: Fight, c: Ctx) => {
  const ok = (d: Debuff) => HEROES[f.hero].dispel.includes(d.type) && !d.trap && !d.lock && !c.g.hold.has(d);
  const left = (u: Unit) => Math.min(...u.debuffs.filter(ok).map(d => d.left));
  const u = byDispel(c.g, c.all.filter(u => left(u) < Infinity).sort((a, b) => left(a) - left(b)), ok)[0];
  return u && paced(f, c.g, u, ok) ? u : null;
};

function autoDruid(f: Fight): void {
  const wr = areaRadius(f, 'wildflower'); // 20인 2칸 · 들꽃 바다 (2026-10-14: 반경 1로만 세서 20인에서 들꽃을 덜 쓰던 것, 20인 악몽 70 → 87%)
  const c = ctx(f, 160, wr);
  if (!c) return;
  const { live, pct, low, idx, ready, g } = c;
  const sprouted = (u: Unit) => u.hots.some(h => h.key === 'sprout' && h.left > 2);
  // 모래시계 창 안 (54 5장): 남는 일만
  if (glassWindow(f, g, live, u => f.mana > 4 && tryUse(f, 'growth', u, idx), () => { if (!ready('natureCleanse')) return false; const d = cleansable(f, c); return !!d && tryUse(f, 'natureCleanse', d, idx); })) return;
  if (ready('quietwood') && live.length === c.all.length && live.filter(u => pct(u) < 0.5).length >= Math.max(2, Math.floor(live.length / 2))) { use(f, 'quietwood', 0); return; }
  if (ready('rebirth') && !f.rebirthUsed && reviveTarget(f) && tryUse(f, 'rebirth', null, idx)) return;
  if (c.busterOn && ready('bark') && pct(c.busterOn) < 0.8 && tryUse(f, 'bark', c.busterOn, idx)) return;
  { const bs = busterShort(f); if (bs && !off(f, bs.u) && f.mana > 4 && tryUse(f, 'growth', bs.u, idx)) return; }
  if (g.pre && ((!sprouted(g.pre) && tryUse(f, 'sprout', g.pre, idx)) || (f.mana > 4 && tryUse(f, 'growth', g.pre, idx)))) return;
  // 띄워 올리기: 예고 동안 해제 → 새싹 (떠 있는 동안은 미리 건 지속 힐만 닿음)
  { const d = g.liftClean[0]; if (d && ready('natureCleanse') && tryUse(f, 'natureCleanse', d, idx)) return; }
  { const v = g.lift.find(u => !sprouted(u)); if (v && f.mana > 2 && tryUse(f, 'sprout', v, idx)) return; }
  // 연쇄 번개: 번개 구름 옆 가장 낮은 사람을 90% 위로 · 떠 있는 사람의 사슬 짝
  if (g.chain && f.mana > 4 && tryUse(f, 'growth', g.chain.u, idx)) return;
  if (g.mate && f.mana > 4 && tryUse(f, 'growth', g.mate, idx)) return;
  // 어둠물: 잠길 줄 사람을 예고 동안 채움 · 빌린 생명: 빚진 사람에게 힐해서 갚기
  if (g.tide && f.mana > 4 && tryUse(f, 'growth', g.tide, idx)) return;
  if (g.debt && (g.debt.due || pct(low) > 0.6) && f.mana > 6 && tryUse(f, 'growth', g.debt.u, idx)) return;
  // 차례: 위급한 사람이 없으면 다음 번호에 새싹 (즉시)
  if (g.order && pct(low) > 0.3 && tryUse(f, 'sprout', g.order, idx)) return;
  // 생명 사슬이 곧 끊어지면 낮은 쪽부터
  if (g.link?.near && ((!sprouted(g.link.u) && tryUse(f, 'sprout', g.link.u, idx)) || (f.mana > 4 && tryUse(f, 'growth', g.link.u, idx)))) return;
  // 신기루가 안 걷힌 예고에 찍힌 사람: 새싹만 미리
  { const v = g.veil.find(u => !sprouted(u)); if (v && f.mana > 10 && tryUse(f, 'sprout', v, idx)) return; }
  // 여럿이 크게 다쳤으면 들꽃 군락부터 (20인에서 한 명씩만 살리다 밀리지 않게)
  if (ready('wildflower') && c.cluster.best && c.cluster.score > aoeBar(f, 800, 160, wr) * healUnit(f) && tryUse(f, 'wildflower', c.cluster.best, idx)) return;
  // 위급: 거둘 지속 힐이 있으면 피워 내기, 없으면 생장
  if (pct(low) < 0.5) {
    if (ready('bloom') && low.hots.length && tryUse(f, 'bloom', low, idx)) return;
    if (!sprouted(low) && f.mana > 2 && tryUse(f, 'sprout', low, idx)) return;
    if (f.mana > 4 && tryUse(f, 'growth', low, idx)) return;
  }
  if (ready('natureCleanse')) { const d = cleansable(f, c); if (d && tryUse(f, 'natureCleanse', d, idx)) return; }
  if (g.cure && pct(low) > 0.4 && f.mana > 4 && tryUse(f, 'growth', g.cure, idx)) return;
  // 헤매는 영혼: 위급한 사람이 없으면 해제로 바로, 아니면 새싹을 깔고 생장
  if (g.soul && pct(low) > 0.5 && f.mana > 10 && ((ready('natureCleanse') && tryUse(f, 'natureCleanse', g.soul, idx)) || (!sprouted(g.soul) && tryUse(f, 'sprout', g.soul, idx)) || tryUse(f, 'growth', g.soul, idx))) return;
  if (g.link && pct(low) > 0.4 && f.mana > 4 && ((!sprouted(g.link.u) && tryUse(f, 'sprout', g.link.u, idx)) || tryUse(f, 'growth', g.link.u, idx))) return;
  const tank = live.find(u => u.role === 'tank' && !sprouted(u)) ?? g.hit.find(u => !sprouted(u));
  if (tank && f.mana > 2 && tryUse(f, 'sprout', tank, idx)) return;
  if (ready('wildflower') && c.cluster.best && c.cluster.score > aoeBar(f, 500, 160, wr) * healUnit(f) && tryUse(f, 'wildflower', c.cluster.best, idx)) return;
  // 새싹은 미리 깔아 둠: 다친 사람부터, 마나가 넉넉하면 멀쩡한 사람에게도 (광역 피해 대비)
  const aoeSoon = g.aoe || f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 6);
  // 역류 중에는 미리 깔기를 쉼 (스킬마다 중첩)
  const bare = g.few ? undefined : live.filter(u => !sprouted(u) && (pct(u) < 0.9 || (aoeSoon && f.mana > 30) || (!!f.tx.on.earlySprout && pct(low) >= 0.8 && !g.save))).sort((a, b) => pct(a) - pct(b))[0]; // 이른 새싹 (77): 멀쩡한 사람에게는 공짜. 다친 사람이 있으면 그쪽 먼저 (힘 모으기처럼 체력 선이 있는 기믹에서 탱커를 놓쳐 3인 보통 0%이던 것)
  if (bare && f.mana > 2 && tryUse(f, 'sprout', bare, idx)) return;
  // 두 겹 새싹 (77): 새싹을 다 깔았고 탱커가 다쳤으면 탱커에게 두 번째 새싹
  if (f.tx.on.twinSprout && f.mana > 20) { const t2 = live.find(u => u.role === 'tank' && pct(u) < 0.9 && u.hots.filter(h => h.key === 'sprout' && h.left > 2).length < 2); if (t2 && tryUse(f, 'sprout', t2, idx)) return; }
  // 새싹을 다 깔았으면 남는 시간엔 생장 (마나가 넉넉할수록 일찍, 보호막 수정이 서 있으면 아낌, 그릇이 있으면 넘치게)
  const cut = g.spill || g.few || g.glassFill ? topUp(f, g, 0.55) : f.mana > 60 && !g.save ? 0.85 : f.mana > 30 ? 0.7 : 0.55;
  if (pct(low) < cut && f.mana > 6 && tryUse(f, 'growth', low, idx)) return;
}

function autoPaladin(f: Fight): void {
  // 봉화는 첫 탱커에게 (배운 뒤 한 번)
  if (f.beacon == null && f.level >= HEROES.paladin.system.lv) { const t = living(f).find(u => u.role === 'tank'); if (t) setBeacon(f, t); }
  // 봉화 대상이 쓰러지면 살아 있는 탱커에게 봉화 스킬 (2026-10-16 빠른 힐 칸)
  { const b = f.beacon != null ? f.party.find(u => u.id === f.beacon) : null, t = b && !b.alive && knows(f, 'beacon') && (f.cd.beacon ?? 0) <= 0 ? living(f).find(u => u.role === 'tank') : null; if (t) use(f, 'beacon', t.cell); }
  const lr = 1 + sv(f, 'wideWave'); // 퍼지는 파도 (42 성기 06)
  const c = ctx(f, 260, lr, waveMax(f)); // 빛의 파도는 가장 다친 4명 (73, 밀려오는 파도면 5명 77)
  if (!c) return;
  const { live, pct, low, idx, ready, g } = c;
  // 모래시계 창 안 (54 5장): 남는 일만
  if (glassWindow(f, g, live, u => (f.mana > 3 && tryUse(f, 'holyLight', u, idx)),
    () => { if (!ready('handCleanse')) return false; const d = cleansable(f, c); return !!d && tryUse(f, 'handCleanse', d, idx); })) return;
  if (ready('sanctuary') && c.cluster.best && live.filter(u => pct(u) < 0.5).length >= Math.max(2, Math.floor(live.length / 2)) && tryUse(f, 'sanctuary', c.cluster.best, idx)) return;
  if (c.busterOn && ready('sacrifice') && tryUse(f, 'sacrifice', c.busterOn, idx)) return;
  if (c.busterOn && ready('beacon') && tryUse(f, 'beacon', c.busterOn, idx)) return; // 봉화 (84): 강타 맞는 탱커에게 회복 + 피해 감소 + 봉화
  if (c.busterOn && ready('handGuard') && pct(c.busterOn) < 0.35 && c.busterOn.role !== 'tank' && tryUse(f, 'handGuard', c.busterOn, idx)) return;
  { const bs = busterShort(f); if (bs && !off(f, bs.u) && ((f.mana > 3 && tryUse(f, 'holyLight', bs.u, idx)))) return; }
  if (g.pre && ((f.mana > 3 && tryUse(f, 'holyLight', g.pre, idx)))) return;
  // 띄워 올리기: 예고 동안 해제 → 빛의 서약 (신성한 힘이 있으면) → 가득 채우기
  { const d = g.liftClean[0]; if (d && ready('handCleanse') && tryUse(f, 'handCleanse', d, idx)) return; }
  { const v = g.lift.find(u => !u.hots.some(h => h.key === 'oath')); if (v && knows(f, 'oath') && f.power3 >= 1 && tryUse(f, 'oath', v, idx)) return; }
  { const v = g.lift.find(u => u.hp < healTop(u) * 0.95); if (v && ((f.mana > 3 && tryUse(f, 'holyLight', v, idx)))) return; }
  // 연쇄 번개: 번개 구름 옆 가장 낮은 사람을 90% 위로 · 떠 있는 사람의 사슬 짝
  if (g.chain && ((f.mana > 3 && tryUse(f, 'holyLight', g.chain.u, idx)))) return;
  if (g.mate && ((f.mana > 3 && tryUse(f, 'holyLight', g.mate, idx)))) return;
  // 어둠물: 잠길 줄 사람을 예고 동안 채움 · 빌린 생명: 빚진 사람에게 힐해서 갚기
  if (g.tide && ((f.mana > 3 && tryUse(f, 'holyLight', g.tide, idx)))) return;
  if (g.debt && (g.debt.due || pct(low) > 0.6) && ((f.mana > 5 && tryUse(f, 'holyLight', g.debt.u, idx)))) return;
  // 차례: 위급한 사람이 없으면 다음 번호에 단일 힐 (빛의 서약 → 빛의 손길)
  if (g.order && pct(low) > 0.3 && ((knows(f, 'oath') && f.power3 >= 1 && tryUse(f, 'oath', g.order, idx)) || (f.mana > 3 && tryUse(f, 'holyLight', g.order, idx)))) return;
  /** 단일 힐 하나: 빛의 손길 (2026-10-16 빛 일격을 없앰) */
  const one = (u: Unit) => (f.mana > 3 && tryUse(f, 'holyLight', u, idx));
  // 생명 사슬이 곧 끊어지면 낮은 쪽부터
  if (g.link?.near && one(g.link.u)) return;
  // 끝없는 빛 (77): 빛의 파도는 2칸부터 (그때 위력 70%라 문턱도 그만큼 낮춤)
  if (f.power3 >= waveNeed(f) && f.power3 < 3 && knows(f, 'lightWave') && c.cluster.best && c.cluster.score > aoeBar(f, 600, 260, lr) * healUnit(f) && tryUse(f, 'lightWave', c.cluster.best, idx)) return;
  if (f.power3 >= 3) {
    if (knows(f, 'lightWave') && c.cluster.best && c.cluster.score > aoeBar(f, 600, 260, lr) * healUnit(f) && tryUse(f, 'lightWave', c.cluster.best, idx)) return;
    const oathless = (u: Unit) => !u.hots.some(h => h.key === 'oath');
    const tank = live.find(u => u.role === 'tank' && oathless(u)) ?? g.hit.find(oathless);
    if (knows(f, 'oath') && tryUse(f, 'oath', tank || low, idx)) return;
  }
  if (ready('handCleanse')) { const d = cleansable(f, c); if (d && tryUse(f, 'handCleanse', d, idx)) return; }
  if (g.cure && pct(low) > 0.4 && one(g.cure)) return;
  // 헤매는 영혼: 위급한 사람이 없으면 해제로 바로, 아니면 단일 힐
  if (g.soul && pct(low) > 0.5 && f.mana > 10 && ((ready('handCleanse') && tryUse(f, 'handCleanse', g.soul, idx)) || one(g.soul))) return;
  if (g.link && pct(low) > 0.4 && one(g.link.u)) return;
  // 봉화 (84): 재사용마다 봉화 대상 (없으면 탱커)이 다쳤으면 다시 걸어 즉시 회복 · 피해 감소
  { const t = live.find(u => u.id === f.beacon) ?? live.find(u => u.role === 'tank'); if (t && ready('beacon') && pct(t) < 0.9 && tryUse(f, 'beacon', t, idx)) return; }
  if (pct(low) < topUp(f, g, 0.85) && f.mana > 3) tryUse(f, 'holyLight', low, idx);
}

// ---------- 주술사 자동 힐러 (79 2-9): 칸을 읽음 (샘 토템 자리 · 연쇄가 이어지는 곳) ----------
const dropped = (u: Unit) => u.hots.some(h => h.key === 'droplet' && h.left > 2);
/** 연쇄 치유 점수: 길을 따라 모자란 체력 (튈 때마다 줄어든 회복량까지) 합 · 80% 아래 인원 */
function chainScore(f: Fight, u: Unit): { score: number; low: number } {
  const path = chainPath(f, u), on = f.tx.on, decay = on.endlessChain ? TX.endlessChain : SHAMAN.chain.decay;
  let amt = SKILLS.chainHeal.amt! * healUnit(f), score = 0, low = 0;
  path.forEach((v, i) => {
    if (i > 0 && !(on.dropChain && dropped(v))) amt *= decay;
    if (off(f, v)) { score = -Infinity; return; } // 힐하면 손해인 사람이 길에 들면 안 씀
    score += Math.min(amt, Math.max(0, healTop(v) - v.hp));
    if (v.hp < healTop(v) * 0.8) low++;
  });
  return { score, low };
}
/**
 * 샘 토템 자리: 범위 안 아군의 모자란 체력 (샘이 다 도는 동안 채울 수 있는 만큼까지) 합이 가장 큰 칸, 장판 · 예고 · 쫄 칸은 뺌.
 * n = 범위 안 다친 사람 (90% 아래). 광역 예고가 곧 오면 멀쩡한 사람도 반만큼 셈 (미리 깔기)
 */
function springCell(f: Fight, live: Unit[]): { cell: number; n: number } | null {
  const r = f.tx.on.freshSpring ? TX.freshSpring.range : SHAMAN.spring.range;
  const cap = SKILLS.springTotem.amt! * (SHAMAN.spring.sec / SHAMAN.spring.tick) * healUnit(f), soon = f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 4);
  let best: { cell: number; n: number; w: number } | null = null;
  const offs = living(f).filter(v => off(f, v));
  for (const c of f.cells) {
    if (c.block || totemBreaks(f, c.i) || f.tels.some(t => t.cells.has(c.i)) || dangerAt(f, c.i)) continue;
    if (offs.some(v => hexDist(cellOf(f, v), c) <= r)) continue; // 힐하면 손해인 사람이 범위에 들면 안 세움
    let n = 0, w = 0;
    for (const v of live) if (hexDist(cellOf(f, v), c) <= r) {
      const gap = Math.max(0, healTop(v) - v.hp);
      if (v.hp < v.max * 0.9) n++;
      w += Math.min(cap, gap) + (soon ? cap / 2 : 0);
    }
    if (w > 0 && (!best || w > best.w)) best = { cell: c.i, n, w };
  }
  return best && { cell: best.cell, n: best.n + (soon ? 2 : 0) };
}

function autoShaman(f: Fight): void {
  const c = ctx(f, 320, 1);
  if (!c) return;
  const { live, pct, low, idx, ready, g } = c;
  /** 단일 힐 하나: 급하면 물방울 (즉시) → 잔물결 (2026-10-16 소나기를 없앰) */
  const one = (u: Unit, hurry: boolean) => (hurry && ready('droplet') && !dropped(u) && tryUse(f, 'droplet', u, idx)) || (f.mana > 3 && tryUse(f, 'ripple', u, idx));
  if (glassWindow(f, g, live, (u, hurry) => one(u, hurry), () => { if (!ready('washing')) return false; const d = cleansable(f, c); return !!d && tryUse(f, 'washing', d, idx); })) return;
  // 위급 (25% 아래): 붙은 아군 평균이 넉넉하면 영혼 잇기, 아니면 물방울 → 잔물결
  const dying = live.filter(u => pct(u) < 0.25).sort((a, b) => pct(a) - pct(b))[0];
  if (dying) {
    const vs = live.filter(v => hexDist(cellOf(f, v), cellOf(f, dying)) <= 1);
    if (ready('spiritLink') && vs.length >= 2 && vs.reduce((a, v) => a + v.hp / v.max, 0) / vs.length >= 0.6 && tryUse(f, 'spiritLink', dying, idx)) return;
    if (one(dying, true)) return;
  }
  // 탱커 버스터: 대지 토템을 탱커 칸에, 모자라면 잔물결로 채움
  if (c.busterOn && ready('earthTotem') && !f.totems.some(t => t.kind === 'earth' && hexDist(f.cells[t.cell], cellOf(f, c.busterOn!)) <= 1) && tryUse(f, 'earthTotem', c.busterOn, idx)) return;
  { const bs = busterShort(f); if (bs && !off(f, bs.u) && one(bs.u, bs.soon)) return; }
  if (g.pre && one(g.pre, true)) return;
  // 띄워 올리기: 예고 동안 해제 → 물방울 (떠 있는 동안은 미리 건 지속 힐만 닿음)
  { const d = g.liftClean[0]; if (d && ready('washing') && tryUse(f, 'washing', d, idx)) return; }
  { const v = g.lift.find(u => !dropped(u)); if (v && ready('droplet') && tryUse(f, 'droplet', v, idx)) return; }
  if (g.chain && one(g.chain.u, g.chain.soon < castOf(f, 'ripple') + 0.3)) return;
  if (g.mate && one(g.mate, false)) return;
  if (g.tide && one(g.tide, pct(g.tide) < 0.5)) return;
  if (g.debt && (g.debt.due || pct(low) > 0.6) && f.mana > 6 && one(g.debt.u, g.debt.due)) return;
  if (g.order && pct(low) > 0.3 && ((ready('droplet') && tryUse(f, 'droplet', g.order, idx)) || (f.mana > 3 && tryUse(f, 'ripple', g.order, idx)))) return;
  if (g.link?.near && one(g.link.u, pct(g.link.u) < 0.5)) return;
  { const v = g.veil.find(u => !dropped(u)); if (v && f.mana > 10 && ready('droplet') && tryUse(f, 'droplet', v, idx)) return; }
  if (ready('washing')) { const d = cleansable(f, c); if (d && tryUse(f, 'washing', d, idx)) return; }
  // 공대 위기: 평균 60% 아래이거나 큰 광역이 곧 → 비구름 토템. 전원을 채우니 힐하면 손해인 사람이 있으면 안 씀 (찬가와 같음)
  const avg = live.reduce((a, u) => a + pct(u), 0) / live.length;
  const bigAoe = f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 3) && live.length >= 5;
  if (ready('rainTotem') && live.length >= 3 && live.length === c.all.length && (avg < 0.6 || (bigAoe && avg < 0.85)) && tryUse(f, 'rainTotem', null, idx)) return;
  // 샘 토템 (빠른 힐 칸, 2026-10-16 가운데 버튼을 없앰): 재사용이 돌면 아군이 가장 많이 모인 칸에. 지금 샘이 6초 넘게 남았고 그 범위에 3명 이상이면 그대로
  if (ready('springTotem') && f.level >= HEROES.shaman.system.lv) {
    const r = f.tx.on.freshSpring ? TX.freshSpring.range : SHAMAN.spring.range;
    const keep = f.totems.some(t => t.kind === 'spring' && t.until - f.t > 6 && live.filter(v => hexDist(cellOf(f, v), f.cells[t.cell]) <= r).length >= 3);
    const at = keep ? null : springCell(f, live);
    if (at && at.n >= (live.length <= 3 ? 1 : live.length <= 5 ? 2 : 3) && use(f, 'springTotem', at.cell).ok) return;
  }
  // 연쇄 치유: 80% 아래 아군이 연쇄로 3명 이상 이어질 때 (물방울 2칸 다리 포함)
  if (knows(f, 'chainHeal') && f.mana >= SKILLS.chainHeal.cost + 2 && calmFor(f, 'chainHeal', g.calm)) {
    let best: Unit | null = null, bs = 0;
    // 연쇄는 마나 1%당 회복이 잔물결보다 낮은 대신 한 번에 크게 (빠르게) 채움: 80% 아래가 연쇄로 3명 이상 이어지고, 길 전체 회복량의 60% 넘게 들어갈 때만
    // (3인 탐험에서 둘만 다쳤을 때 쓰면 마나가 먼저 바닥남)
    for (const u of live) { if (u.hp >= healTop(u) * 0.8) continue; const sc = chainScore(f, u); if (sc.low >= 3 && sc.score > bs) { bs = sc.score; best = u; } }
    const full = SKILLS.chainHeal.amt! * (1 + SHAMAN.chain.decay + SHAMAN.chain.decay ** 2 + SHAMAN.chain.decay ** 3);
    if (best && f.mana > 15 && bs > full * (f.mana > 50 ? 0.55 : 0.7) * healUnit(f) && tryUse(f, 'chainHeal', best, idx)) return;
  }
  if (g.cure && pct(low) > 0.4 && one(g.cure, pct(g.cure) < 0.5)) return;
  if (g.soul && pct(low) > 0.5 && f.mana > 10 && ((ready('washing') && tryUse(f, 'washing', g.soul, idx)) || one(g.soul, false))) return;
  if (g.link && pct(low) > 0.4 && one(g.link.u, false)) return;
  // 물방울: 재사용마다 탱커 → 물방울 없는 가장 다친 아군
  // 물방울: 재사용마다 탱커 (계속 맞는 사람) → 물방울 없는 가장 다친 아군 (85% 아래). 멀쩡한 사람에게는 넘쳐서 마나만 씀 (광역이 곧 오면 미리)
  if (ready('droplet') && !g.few) {
    const soon = g.aoe || f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 6);
    const small = live.length <= 5; // 5인 이하: 탱커에게 늘 (계속 맞음). 레이드: 탱커도 다쳤을 때만 (탱커 둘에게 늘 걸면 넘쳐서 마나가 먼저 바닥남)
    const t = live.find(u => u.role === 'tank' && !dropped(u) && (small || pct(u) < 0.95)) ?? g.hit.find(u => !dropped(u)) ?? live.filter(u => !dropped(u) && (pct(u) < (small ? 0.85 : 0.8) || (soon && f.mana > 30))).sort((a, b) => pct(a) - pct(b))[0];
    if (t && tryUse(f, 'droplet', t, idx)) return;
  }
  if (pct(low) < topUp(f, g, f.mana > 40 ? 0.85 : 0.75) && f.mana > 3) tryUse(f, 'ripple', low, idx);
}

// ---------- 수도사 자동 힐러 (79 3-9): 손바닥 박자를 지키며 안개를 깔아 둠 ----------
const mistOn = (u: Unit) => u.hots.some(h => h.key === 'wanderMist' && h.left > 2);
/** 안개 숨결 자리: 75% 아래 아군 (안개가 걸린 아군은 2명으로) 수가 가장 많은 사람. 힐하면 손해인 사람이 범위에 들면 안 씀 */
function breathAt(f: Fight, live: Unit[], all: Unit[], r: number): { best: Unit | null; n: number; score: number } {
  const cap = SKILLS.mistBreath.amt! * healUnit(f);
  let best: Unit | null = null, bn = 0, bs = 0;
  for (const c of live) {
    let n = 0, sc = 0, bad = false;
    for (const v of all) if (hexDist(cellOf(f, v), cellOf(f, c)) <= r) {
      if (off(f, v)) { bad = true; break; }
      const m = misted(f, v) ? 1 + MONK.breath.mist : 1;
      if (v.hp < healTop(v) * 0.75) n += m >= 1.5 ? 2 : 1;
      sc += Math.min(cap * m, Math.max(0, healTop(v) - v.hp));
    }
    if (!bad && (n > bn || (n === bn && sc > bs))) { best = c; bn = n; bs = sc; }
  }
  return { best, n: bn, score: bs };
}

function autoMonk(f: Fight): void {
  // 차 한 잔은 GCD를 안 써서 시전 · GCD 중에도: 마나 85% 아래면 재사용마다
  if (!f.over && knows(f, 'tea') && (f.cd.tea ?? 0) <= 0 && f.mana < 85 && !f.lock.tea) use(f, 'tea', 0);
  const br = breathRange(f);
  const c = ctx(f, 160, br);
  if (!c) return;
  const { live, pct, low, idx, ready, g } = c;
  /** 단일 힐 하나: 급하면 감싸기 (82: 즉시 · 리듬 비례, 재사용 6초), 아니면 손바닥 */
  const one = (u: Unit, hurry: boolean) => (hurry && f.mana > 8 && tryUse(f, 'mistWrap', u, idx)) || (f.mana > 2 && tryUse(f, 'vitalPalm', u, idx));
  if (glassWindow(f, g, live, (u, hurry) => one(u, hurry), () => { if (!ready('clearChi')) return false; const d = cleansable(f, c); return !!d && tryUse(f, 'clearChi', d, idx); })) return;
  // 위급 (25% 아래): 탱커 버스터 중이면 누그러뜨림, 아니면 손바닥 (즉시라 먼저) → 감싸기
  const dying = live.filter(u => pct(u) < 0.25).sort((a, b) => pct(a) - pct(b))[0];
  if (dying) {
    if (c.busterOn === dying && ready('soothe') && tryUse(f, 'soothe', dying, idx)) return;
    if (ready('mistWrap') && tryUse(f, 'mistWrap', dying, idx)) return; // 82: 감싸기도 즉시라 큰 쪽부터
    if (f.mana > 2 && tryUse(f, 'vitalPalm', dying, idx)) return;
  }
  if (c.busterOn && ready('soothe') && tryUse(f, 'soothe', c.busterOn, idx)) return;
  { const bs = busterShort(f); if (bs && !off(f, bs.u) && one(bs.u, false)) return; }
  if (g.pre && one(g.pre, false)) return;
  // 띄워 올리기: 예고 동안 해제 → 안개 (떠 있는 동안은 미리 건 지속 힐만 닿음)
  { const d = g.liftClean[0]; if (d && ready('clearChi') && tryUse(f, 'clearChi', d, idx)) return; }
  { const v = g.lift.find(u => !mistOn(u)); if (v && ready('wanderMist') && tryUse(f, 'wanderMist', v, idx)) return; }
  if (g.chain && one(g.chain.u, false)) return;
  if (g.mate && one(g.mate, false)) return;
  if (g.tide && one(g.tide, false)) return;
  if (g.debt && (g.debt.due || pct(low) > 0.6) && f.mana > 6 && one(g.debt.u, false)) return;
  if (g.order && pct(low) > 0.3 && ((ready('wanderMist') && tryUse(f, 'wanderMist', g.order, idx)) || one(g.order, false))) return;
  if (g.link?.near && one(g.link.u, false)) return;
  { const v = g.veil.find(u => !mistOn(u)); if (v && f.mana > 10 && ready('wanderMist') && tryUse(f, 'wanderMist', v, idx)) return; }
  if (ready('clearChi')) { const d = cleansable(f, c); if (d && tryUse(f, 'clearChi', d, idx)) return; }
  // 공대 위기: 평균 60% 아래이거나 큰 광역이 곧 → 되살림 바람 (전원을 채우니 힐하면 손해인 사람이 있으면 안 씀)
  const avg = live.reduce((a, u) => a + pct(u), 0) / live.length;
  const bigAoe = f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 1.5) && live.length >= 5;
  if (ready('reviveWind') && live.length >= 3 && live.length === c.all.length && (avg < 0.6 || (bigAoe && avg < 0.8)) && tryUse(f, 'reviveWind', null, idx)) return;
  // 안개 숨결: 75% 아래 아군 3명 이상 (안개가 걸린 아군은 2명으로, 작은 파티는 닿는 인원만큼)
  if (ready('mistBreath') && calmFor(f, 'mistBreath', g.calm)) {
    const b = breathAt(f, live, c.all, br);
    if (b.best && b.n >= Math.min(3, live.length) && f.mana > 12 && tryUse(f, 'mistBreath', b.best, idx)) return;
  }
  if (g.cure && pct(low) > 0.4 && one(g.cure, false)) return;
  if (g.soul && pct(low) > 0.5 && f.mana > 10 && ((ready('clearChi') && tryUse(f, 'clearChi', g.soul, idx)) || one(g.soul, false))) return;
  if (g.link && pct(low) > 0.4 && one(g.link.u, false)) return;
  // 떠도는 안개: 재사용마다 탱커 → 안개 없는 가장 다친 아군 (레이드는 탱커도 다쳤을 때만)
  if (ready('wanderMist') && !g.few) {
    const small = live.length <= 5;
    const t = live.find(u => u.role === 'tank' && !mistOn(u) && (small || pct(u) < 0.95)) ?? g.hit.find(u => !mistOn(u)) ?? live.filter(u => !mistOn(u) && pct(u) < 0.9).sort((a, b) => pct(a) - pct(b))[0];
    if (t && tryUse(f, 'wanderMist', t, idx)) return;
  }
  // 리듬 지키기: 끊기기 0.8초 전이면 손바닥 (다친 사람, 없으면 탱커)
  const tank = live.find(u => u.role === 'tank') ?? low;
  if (f.beat >= 1 && f.beatUntil - f.t < 0.8 && f.mana > 20) { const v = pct(low) < 0.999 ? low : tank; if (tryUse(f, 'vitalPalm', v, idx)) return; }
  if (pct(low) < 0.4 && f.mana > 30 && tryUse(f, 'mistWrap', low, idx)) return;
  if (pct(low) < topUp(f, g, f.mana > 40 ? 0.9 : 0.8) && f.mana > 2 && tryUse(f, 'vitalPalm', low, idx)) return;
  // 다친 사람이 없어도 리듬 3 이상이면 탱커에게 이어 침 (마나 50% 위일 때만)
  if (f.beat >= MONK.beat.mistFast && f.mana > 50) tryUse(f, 'vitalPalm', tank, idx);
}

// ---------- 점성술사 자동 힐러 (79 4-9, 83): 별 조각을 모았다 별자리 시전으로 터뜨림 ----------
const marked = (u: Unit) => u.hots.some(h => h.key === 'starMark' && h.left > 2);
/**
 * 별비 자리 (83: 별 수 = 지금 조각으로 정해짐): 75% 아래 아군이 별 4개 (2칸 거리)면 4명, 별 3개 (한 칸 둘레)면 3명, 별 2개면 4명 이상일 때 그 가운데.
 * 조각이 없으면 (별 1개 한 명) 안 씀. 힐하면 손해인 사람이 범위에 들면 안 씀
 */
function fallPlan(f: Fight, live: Unit[], all: Unit[]): Unit | null {
  const stars = starsNow(f);
  if (stars < 2) return null;
  const low = (v: Unit) => v.hp < healTop(v) * 0.75;
  const r = fallSpec(f, stars).r, need = Math.min(stars >= 4 ? 4 : stars === 3 ? 3 : 4, live.length);
  let best: { u: Unit; n: number } | null = null;
  for (const c of live) {
    let n = 0;
    for (const v of all) if (hexDist(cellOf(f, v), cellOf(f, c)) <= r) { if (off(f, v)) { n = -1; break; } if (low(v)) n++; }
    if (n >= need && (!best || n > best.n)) best = { u: c, n };
  }
  return best?.u ?? null;
}

function autoAstro(f: Fight): void {
  const c = ctx(f, 220, 1);
  if (!c) return;
  const { live, pct, low, idx, ready, g } = c;
  /** 별자리 시전 (83) */
  const charge = (k: SkillKey, u: Unit): boolean => ready(k) && tryUse(f, k, u, idx);
  const one = (u: Unit, hurry: boolean) => (hurry && ready('twinkle') && tryUse(f, 'twinkle', u, idx)) || (f.mana > 3 && tryUse(f, 'starHeal', u, idx));
  if (glassWindow(f, g, live, (u, hurry) => one(u, hurry), () => { if (!ready('clearStar')) return false; const d = cleansable(f, c); return !!d && tryUse(f, 'clearStar', d, idx); })) return;
  // 위급 (25% 아래): 반짝임 → 북극성 (지금 조각대로)
  const dying = live.filter(u => pct(u) < 0.25 && !asleep(f, u)).sort((a, b) => pct(a) - pct(b))[0];
  if (dying) {
    if (ready('twinkle') && tryUse(f, 'twinkle', dying, idx)) return;
    if (knows(f, 'polaris') && charge('polaris', dying)) return;
  }
  // 탱커 버스터: 별의 잠은 쓰지 않음 → 표식을 미리, 예고가 떨어진 뒤 북극성
  if (c.busterOn && !marked(c.busterOn) && f.mana > 3 && tryUse(f, 'starMark', c.busterOn, idx)) return;
  { const bs = busterShort(f); if (bs && !off(f, bs.u) && one(bs.u, bs.soon)) return; }
  if (g.pre && one(g.pre, false)) return;
  // 띄워 올리기: 예고 동안 해제 → 표식 (떠 있는 동안은 미리 건 지속 힐만 닿음)
  { const d = g.liftClean[0]; if (d && ready('clearStar') && tryUse(f, 'clearStar', d, idx)) return; }
  { const v = g.lift.find(u => !marked(u)); if (v && f.mana > 3 && tryUse(f, 'starMark', v, idx)) return; }
  if (g.chain && one(g.chain.u, g.chain.soon < castOf(f, 'starHeal') + 0.3)) return;
  if (g.mate && one(g.mate, false)) return;
  if (g.tide && one(g.tide, pct(g.tide) < 0.5)) return;
  if (g.debt && (g.debt.due || pct(low) > 0.6) && f.mana > 6 && one(g.debt.u, g.debt.due)) return;
  if (g.order && pct(low) > 0.3 && ((ready('twinkle') && tryUse(f, 'twinkle', g.order, idx)) || (f.mana > 3 && tryUse(f, 'starMark', g.order, idx)))) return;
  if (g.link?.near && one(g.link.u, pct(g.link.u) < 0.5)) return;
  if (ready('clearStar')) { const d = cleansable(f, c); if (d && tryUse(f, 'clearStar', d, idx)) return; }
  // 공대 위기: 파티 평균 잃은 체력 40% 이상 → 별의 기억 (전원을 채우니 힐하면 손해인 사람이 없을 때만)
  const avg = live.reduce((a, u) => a + pct(u), 0) / live.length;
  // 83: 별의 기억도 시전 (지금 조각대로 별 1 + 조각개 = 별마다 2초)
  if (ready('starMemory') && live.length >= 3 && live.length === c.all.length && avg < 0.6 && charge('starMemory', f.me)) return;
  // 별비: 지금 조각으로 정해진 별 수의 범위에 다친 아군이 모여 있으면 (fallPlan)
  if (ready('starfall') && f.mana > 14) {
    const p = fallPlan(f, live, c.all);
    if (p && charge('starfall', p)) return;
  }
  // 북극성: 탱커 (또는 계속 맞는 사람) 체력 55% 아래면, 조각이 2개 넘게 모였거나 40% 아래일 때
  { const t = live.filter(u => (u.role === 'tank' || g.hit.includes(u)) && pct(u) < 0.55 && !asleep(f, u)).sort((a, b) => pct(a) - pct(b))[0];
    if (t && knows(f, 'polaris') && (f.shards >= 2 || pct(t) < 0.4) && charge('polaris', t)) return; }
  if (g.cure && pct(low) > 0.4 && one(g.cure, pct(g.cure) < 0.5)) return;
  if (g.soul && pct(low) > 0.5 && f.mana > 10 && ((ready('clearStar') && tryUse(f, 'clearStar', g.soul, idx)) || one(g.soul, false))) return;
  if (g.link && pct(low) > 0.4 && one(g.link.u, false)) return;
  // 반짝임: 45% 아래 1명
  if (pct(low) < 0.45 && ready('twinkle') && tryUse(f, 'twinkle', low, idx)) return;
  // 표식: 탱커에게 끊기지 않게 (레이드는 다쳤을 때만)
  if (!g.few) {
    const small = live.length <= 5;
    const t = live.find(u => u.role === 'tank' && !marked(u) && (small || pct(u) < 0.95)) ?? g.hit.find(u => !marked(u));
    if (t && f.mana > 10 && tryUse(f, 'starMark', t, idx)) return;
  }
  if (pct(low) < topUp(f, g, f.mana > 40 ? 0.85 : 0.75) && f.mana > 3) tryUse(f, 'starHeal', low, idx);
}

// ---------- 결계사 자동 힐러 (79 5-9): 막과 인장을 미리 깔고 심판으로 정리 ----------
function autoWarder(f: Fight): void {
  const c = ctx(f, 150, 1);
  if (!c) return;
  const { live, pct, low, idx, ready, g } = c;
  const melt = !!f.melt && f.t < f.melt.until; // 보호막이 녹는 동안 (P-MELT): 막 · 결계 원 대신 인장 치유 · 심판 위주
  const shieldLow = (u: Unit) => absorbLeft(f, u) < u.max * (f.mana > 50 ? 0.3 : 0.15); // 마나가 넉넉하면 막을 두껍게 (상한 60%)
  /** 단일 힐 하나: 급하면 빛의 막 (즉시, 녹는 동안은 빼고) → 인장 치유 (2026-10-16 빠른 인장을 없앰) */
  const one = (u: Unit, hurry: boolean) => (hurry && !melt && ready('lightBarrier') && tryUse(f, 'lightBarrier', u, idx)) || (f.mana > 3 && tryUse(f, 'sealHeal', u, idx));
  if (glassWindow(f, g, live, (u, hurry) => one(u, hurry), () => { if (!ready('wardCleanse')) return false; const d = cleansable(f, c); return !!d && tryUse(f, 'wardCleanse', d, idx); })) return;
  // 위급 (25% 아래): 탱커 버스터 중이면 수호 결계 → 빛의 막 → 인장 치유
  const dying = live.filter(u => pct(u) < 0.25).sort((a, b) => pct(a) - pct(b))[0];
  if (dying) {
    if (c.busterOn === dying && !melt && ready('guardWard') && tryUse(f, 'guardWard', dying, idx)) return; // 82: 수호 결계도 보호막이라 녹는 동안은 안 씀
    if (one(dying, true)) return;
  }
  // 탱커 버스터: 막이 없거나 얇으면 빛의 막
  if (c.busterOn && !melt && ready('lightBarrier') && shieldLow(c.busterOn) && tryUse(f, 'lightBarrier', c.busterOn, idx)) return;
  if (c.busterOn && !melt && ready('guardWard') && pct(c.busterOn) < 0.5 && tryUse(f, 'guardWard', c.busterOn, idx)) return;
  { const bs = busterShort(f); if (bs && !off(f, bs.u) && one(bs.u, bs.soon)) return; }
  if (g.pre && ((!melt && ready('lightBarrier') && shieldLow(g.pre) && tryUse(f, 'lightBarrier', g.pre, idx)) || one(g.pre, false))) return;
  { const d = g.liftClean[0]; if (d && ready('wardCleanse') && tryUse(f, 'wardCleanse', d, idx)) return; }
  if (g.chain && one(g.chain.u, g.chain.soon < castOf(f, 'sealHeal') + 0.3)) return;
  if (g.mate && one(g.mate, false)) return;
  if (g.tide && one(g.tide, pct(g.tide) < 0.5)) return;
  if (g.debt && (g.debt.due || pct(low) > 0.6) && f.mana > 6 && one(g.debt.u, g.debt.due)) return;
  if (g.order && pct(low) > 0.3 && one(g.order, true)) return;
  if (g.link?.near && one(g.link.u, pct(g.link.u) < 0.5)) return;
  if (ready('wardCleanse')) { const d = cleansable(f, c); if (d && tryUse(f, 'wardCleanse', d, idx)) return; }
  // 광역 예고: 결계 원을 맞을 사람이 가장 많은 사람 칸에, 큰 광역이면 빛의 장막
  const aoeSoon = g.aoe || f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 3.5);
  const avg = live.reduce((a, u) => a + pct(u), 0) / live.length;
  if ((aoeSoon && live.length >= 5) || (avg < 0.6 && live.length >= 3)) {
    const center = live.slice().sort((a, b) => live.filter(v => hexDist(cellOf(f, v), cellOf(f, b)) <= 2).length - live.filter(v => hexDist(cellOf(f, v), cellOf(f, a)) <= 2).length)[0];
    if (center && !melt && ready('lightVeil') && (avg < 0.6 || f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 2)) && tryUse(f, 'lightVeil', center, idx)) return; // 82: 전원 보호막 (녹는 동안은 안 씀)
  }
  // 결계 원: 광역 예고가 곧 오거나, 한 칸 둘레에 85% 아래 아군이 3명 이상 (막과 인장을 깔아 심판으로 이어 감)
  if (!melt && ready('wardCircle') && f.mana > 12) {
    const r = circleRange(f), lowN = (c0: Unit) => live.filter(v => hexDist(cellOf(f, v), cellOf(f, c0)) <= r && pct(v) < 0.85).length;
    const center = live.filter(u => !c.all.some(v => off(f, v) && hexDist(cellOf(f, v), cellOf(f, u)) <= r)).sort((a, b) => lowN(b) - lowN(a))[0];
    if (center && (aoeSoon || lowN(center) >= Math.min(3, live.length)) && tryUse(f, 'wardCircle', center, idx)) return;
  }
  // 심판: 인장이 붙은 아군 중 85% 아래가 3명 이상
  if (knows(f, 'judgment') && judgeReady(f) && f.mana > 8) {
    const n = sealTargets(f, 20).filter(v => pct(v) < 0.85).length;
    if (n >= 3 && use(f, 'judgment', 0).ok) return; // 2명이면 마나 1%당 회복이 인장 치유보다 한참 낮음
  }
  if (g.cure && pct(low) > 0.4 && one(g.cure, pct(g.cure) < 0.5)) return;
  if (g.soul && pct(low) > 0.5 && f.mana > 10 && ((ready('wardCleanse') && tryUse(f, 'wardCleanse', g.soul, idx)) || one(g.soul, false))) return;
  if (g.link && pct(low) > 0.4 && one(g.link.u, false)) return;
  // 결계 굳히기 (84, 빛의 창 대신): 내 보호막이 2명 이상에게 있고 그중 곧 끝나는 막이 있거나, 큰 광역이 곧 올 때 (녹는 동안은 안 씀)
  if (ready('wardHold') && !melt) {
    const ms = live.map(v => v.mods.find(m => m.k === 'absorb' && m.src === 'healer' && m.until > f.t && m.v > 0)).filter(Boolean) as { until: number }[];
    if (ms.length >= Math.min(2, live.length) && (ms.some(m => m.until - f.t < 4) || aoeSoon) && use(f, 'wardHold', 0).ok) return;
  }
  // 빛의 막: 재사용마다 탱커 (레이드는 다쳤을 때) → 계속 맞는 사람
  if (!melt && ready('lightBarrier') && !g.few) {
    const small = live.length <= 5;
    const t = live.find(u => u.role === 'tank' && shieldLow(u) && (small || pct(u) < 0.95)) ?? g.hit.find(shieldLow);
    if (t && tryUse(f, 'lightBarrier', t, idx)) return;
  }
  if (pct(low) < topUp(f, g, f.mana > 40 ? 0.85 : 0.75) && f.mana > 3) { tryUse(f, 'sealHeal', low, idx); return; }
  // 아무도 크게 안 다쳤으면: 인장이 곧 끝나는 탱커에게 막 (마나가 넉넉할 때)
  if (!melt && ready('lightBarrier') && f.mana > 50) { const t = live.find(u => u.role === 'tank' && (!sealed(f, u) || (u.seal ?? 0) - f.t < 3)); if (t) tryUse(f, 'lightBarrier', t, idx); }
}

/** 자동 힐러로 한 판 끝까지 */
export function simulate(cfg: FightConfig, maxT = 700): Fight {
  const f = create(cfg);
  while (!f.over && f.t < maxT) { autoHealer(f); step(f); f.events.length = 0; }
  return f;
}
