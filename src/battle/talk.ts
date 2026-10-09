/**
 * 파티원 말풍선 감독 (41 문서). 전투 사건(F.events)과 상태 변화를 보고 누가 어떤 상황에서 말할지 정해 말풍선을 돌려준다.
 * 엔진 상태는 읽기만 하고 고치지 않는다 (전투 결과·전투 난수에 영향 없음). 난수는 화면 쪽 것을 씀.
 * 말 빈도는 절제 (아래 PACE·PER_MIN): 우선순위 위기 > 기믹·실수 신호 > 반응·잡담 (04 10장), 판에 동시에 3개까지.
 */
import { ABILITIES } from '../data/abilities';
import { hasOwnLines, pickLine, SITS, type Speaker, type TalkSit } from '../data/talk';
import { hotCount, type Fight, type FightEvent, type Unit } from '../engine';
import type { BubbleKind } from './board';

/** kind = 말풍선 테두리 (위기 · 기믹·신호 · 반응 · 쓰러진 사람) */
export interface TalkBubble { id: number; text: string; life: number; sit: TalkSit | null; kind: BubbleKind }

/** 전투를 시작할 때 화면이 알려 주는 것 */
export interface TalkStart {
  /** 던전 구간 번호 (0부터)와 구간 수 */
  seg: number;
  segN: number;
  /** 광고 이어하기 횟수 */
  cont: number;
  affix: boolean;
  chal: boolean;
}

interface Cand {
  sit: TalkSit;
  /** self 상황의 주인공 · other 상황에서 빼는 사람 */
  u?: Unit;
  /** {ally} 자리에 들어갈 사람 */
  ally?: Unit;
}

interface UState {
  ratio: number;
  alive: boolean;
  /** 마지막으로 회복한 뒤 가장 낮았던 체력 비율 (살림·다시 가득 판단) */
  low: number;
  marks: { 50: boolean; 25: boolean; 10: boolean };
  hist: [number, number][];
  hurtAt: number;
  shield: boolean;
  guard: boolean;
  immune: boolean;
  hots: number;
  pulled: boolean;
  sulking: boolean;
  fleeing: boolean;
  moving: boolean;
  cell: number;
  debs: Map<number, number>;
  debLong: Set<number>;
  lastHeal: number;
  noHealAt: number;
  aimFull: boolean;
  zoneSince: number | null;
  addOn: boolean;
  /** 자폭 쫄이 노리는 중 */
  fixed: boolean;
  /** 감옥 디버프 id → 이름 */
  jails: Map<number, string>;
}

interface TelSeen { kind?: string; cells: Set<number>; safe: boolean; was: Set<number> }

/*
 * 정신없지 않게 (Lim 2026-10-09 「너무 정신없게 자주 나오지 않게」): 대사 종류는 많이, 나오는 횟수는 절제.
 * 엔진 말풍선(실수 신호 …)과 시작·끝 인사는 이 제한 밖 (전과 같이 꼭 뜸)
 */
/** 같은 사람이 다시 말하기까지 (ms) · 위기는 짧게 */
const UNIT_GAP = 10000, UNIT_GAP_CRISIS = 4000;
/** 우선순위별: 앞 말풍선에서 gap(ms)이 지나고, 판에 떠 있는 말풍선이 live개보다 적어야 말함 (반응은 판이 비어 있을 때만) */
const PACE = { 1: { gap: 6000, live: 1 }, 2: { gap: 2500, live: 2 }, 3: { gap: 1000, live: 3 } } as const;
/** 1분 동안 이 감독이 내는 말풍선 수 (5인 · 10인 · 20인). 넘으면 위기만 2개 더 */
const PER_MIN = { small: 5, raid: 6, big: 7 };
/** 같은 전투에서 같은 상황이 또 오면 확률이 이만큼씩 줄고, 처음 확률의 이 비율 밑으로는 안 내려감 */
const REPEAT_DECAY = 0.6, REPEAT_FLOOR = 0.2;
/** 엔진 말풍선 중 신호가 아닌 것 (빈도 제한을 받음) */
const SOFT_BARKS: TalkSit[] = ['thanks', 'dodge'];
/** 한 사람이 말을 몰아서 하지 않게: 가장 적게 말한 사람보다 이만큼 더 말했으면 위기 말고는 쉼 */
const SHARE = 2;

export function createTalk(rand: () => number = Math.random) {
  let F: Fight | null = null;
  let info: TalkStart = { seg: 0, segN: 1, cont: 0, affix: false, chal: false };
  let us = new Map<number, UState>();
  let tels = new Map<number, TelSeen>();
  let queue: { at: number; c: Cand; force?: boolean }[] = [];
  let used = new Set<string>();
  let spoke = new Map<number, number>();
  /** 이번 전투에 제한 안에서 말한 수 (사람마다) */
  let said = new Map<number, number>();
  let count: Partial<Record<TalkSit, number>> = {};
  let live: number[] = [];
  let lastAny = -1e9;
  /** 제한 안에서 낸 말풍선 시각 (1분 예산) */
  let recent: number[] = [];
  let st = fresh();
  // 다시 도전 판단: 지난 전투의 파티와 결과 (화면을 넘어가도 남음)
  let lastParty = '', lastLost = false;

  function fresh() {
    return {
      phase: 1, enraged: false, noTank: false, invuln: false, rats: false, adds: new Set<number>(), liveAdds: new Set<number>(), holes: 0,
      order: false, orderWrong: 0, daze: false, mana: { low: false, empty: false }, healerLow: false,
      boss: new Set<number>(), long: false, enrageSoon: false, partyLowAt: -1e9, fullSince: null as number | null, allFullAt: -1e9,
      threatAt: 0, idleAt: 0, leader: 0, leaderAt: 0, lastStand: false, raidCasts: 0, over: false, pulling: true, startAt: 0,
    };
  }

  const ratio = (u: Unit) => (u.max > 0 ? u.hp / u.max : 0);
  const spk = (u: Unit): Speaker => ({ pers: u.pers, cls: u.cls, role: u.role });
  const big = () => !!F?.enc.big;

  function snap(u: Unit, now: number): UState {
    return {
      ratio: ratio(u), alive: u.alive, low: ratio(u), marks: { 50: false, 25: false, 10: false }, hist: [[now, ratio(u)]], hurtAt: -1e9,
      shield: u.shield > 0, guard: u.guardian > 0 || u.redu > 0 || u.sacr > 0, immune: u.immune > 0, hots: hotCount(u), pulled: !!u.pulled,
      sulking: u.sulking, fleeing: u.fleeing, moving: !!u.moving, cell: u.cell, debs: new Map(u.debuffs.map(d => [d.id, 0])), debLong: new Set(),
      lastHeal: 0, noHealAt: -1e9, aimFull: false, zoneSince: null, addOn: false, fixed: false, jails: new Map(u.debuffs.filter(d => d.jail).map(d => [d.id, d.name])),
    };
  }

  /** 전투 시작 (구간마다). 카운트다운 동안 할 말을 예약 */
  function start(f: Fight, i: TalkStart, now: number): void {
    F = f; info = i;
    us = new Map(f.party.filter(u => !u.me).map(u => [u.id, snap(u, now)]));
    tels = new Map(); queue = []; used = new Set(); spoke = new Map(); said = new Map(); count = {}; live = []; lastAny = -1e9; recent = [];
    st = fresh(); st.startAt = now; st.phase = f.phase; st.holes = holes(f);
    const party = f.party.filter(u => !u.me).map(u => u.nick).join(',');
    const retry = i.cont > 0 || (party === lastParty && lastLost && i.seg === 0);
    lastParty = party; lastLost = false;
    // 첫 마디: 인사 · 다시 도전 · 다음 구간
    const first: TalkSit | null = retry ? 'retry' : i.seg > 0 ? 'nextSeg' : 'hello';
    queue.push({ at: now + 250, c: { sit: first } });
    // 둘째 마디: 콘텐츠·난이도·어픽스 중 하나
    const content: TalkSit = f.enc.comp.tank >= 2 || f.party.length >= 10 ? 'pullRaid' : f.bodyHp ? (f.mobs.some(m => m.elite) ? 'pullElite' : 'pullTrash') : 'pullBoss';
    const extra: TalkSit[] = [];
    const diff = f.cfg.diff;
    if (diff === '악몽') extra.push('pullNightmare'); else if (diff === '어려움') extra.push('pullHard'); else if (diff === '쉬움') extra.push('pullEasy');
    if (i.affix) extra.push('pullAffix');
    if (i.chal) extra.push('pullChal');
    const second = extra.length && rand() < 0.5 ? extra[Math.floor(rand() * extra.length)] : content;
    if (rand() < 0.6) queue.push({ at: now + 1400, c: { sit: second } });
  }

  const holes = (f: Fight) => f.cells.filter(c => c.block === 'hole').length;
  const bossName = (f: Fight): string => {
    if (!f.bodyHp) return f.enc.name;
    const m = f.mobs.find(x => x.alive && !x.add && (x.boss || x.elite)) || f.mobs.find(x => x.alive && !x.add);
    return m ? m.name : f.enc.name;
  };

  // ---------- 말하기 ----------
  function chance(sit: TalkSit): number {
    const base = SITS[sit].chance * (big() && SITS[sit].prio < 3 ? 0.7 : 1);
    const n = count[sit] ?? 0;
    return Math.max(base * REPEAT_FLOOR, base * REPEAT_DECAY ** n);
  }

  /** 말할 사람. force(시작·끝 인사)면 방금 말한 사람도 됨 (안 말한 사람 먼저) */
  function speakerFor(c: Cand, now: number, force: boolean): Unit | null {
    const f = F!, def = SITS[c.sit];
    const gap = def.prio === 3 ? UNIT_GAP_CRISIS : UNIT_GAP;
    const rested = (u: Unit) => now - (spoke.get(u.id) ?? -1e9) > gap;
    if (def.who === 'self') return c.u && (c.u.alive || def.dead) && (force || (rested(c.u) && (def.prio === 3 || !talkative(c.u)))) ? c.u : null;
    // tank 상황의 u = 그 일을 맡은 사람 (탱커면 그 사람이 말함)
    let pool = f.party.filter(u => !u.me && (u.alive || def.dead) && (def.who === 'tank' || u !== c.u) && u !== c.ally);
    if (def.dead) { const alive = pool.filter(u => u.alive); if (alive.length && rand() < 0.6) pool = alive; }
    if (def.who === 'tank') {
      const tk = pool.filter(u => u.role === 'tank' && u.alive), mine = tk.filter(u => u === c.u);
      if (mine.length) pool = mine; else if (tk.length) pool = tk;
    }
    const fresh = pool.filter(rested);
    if (fresh.length || !force) pool = fresh;
    if (!pool.length) return null;
    const own = pool.filter(u => hasOwnLines(c.sit, spk(u)));
    if (own.length) pool = own;
    // 말을 덜 한 사람 먼저
    const low = Math.min(...pool.map(u => said.get(u.id) ?? 0));
    pool = pool.filter(u => (said.get(u.id) ?? 0) <= low + 1);
    return pool[Math.floor(rand() * pool.length)];
  }

  /** 이 사람이 다른 사람보다 너무 많이 말했나 (탱커처럼 사건이 몰리는 사람) */
  function talkative(u: Unit): boolean {
    const others = F!.party.filter(x => !x.me && x.alive && x !== u);
    if (!others.length) return false;
    return (said.get(u.id) ?? 0) >= Math.min(...others.map(x => said.get(x.id) ?? 0)) + SHARE;
  }

  function lineFor(c: Cand, u: Unit): string | null {
    const f = F!;
    const tanks = f.party.filter(x => x.alive && x.role === 'tank' && x !== u);
    const tank = tanks.length ? tanks[Math.floor(rand() * tanks.length)] : null;
    const boss = bossName(f);
    const ok = (t: string) => (!t.includes('{ally}') || !!c.ally) && (!t.includes('{tank}') || !!tank) && (!t.includes('{boss}') || !!boss);
    const t = pickLine(c.sit, spk(u), rand, used, ok);
    if (!t) return null;
    used.add(t);
    return t.replace(/\{ally\}/g, c.ally?.nick ?? '').replace(/\{tank\}/g, tank?.nick ?? '').replace(/\{boss\}/g, boss);
  }

  function say(out: TalkBubble[], u: Unit, text: string, sit: TalkSit | null, now: number): void {
    const life = Math.max(1700, Math.min(2800, 1200 + 75 * [...text].length));
    const def = sit ? SITS[sit] : null;
    const kind: BubbleKind = !u.alive ? 'chat' : !def ? 'call' : def.group === '시작' || def.group === '끝' ? 'talk' : def.prio === 3 ? 'alert' : def.prio === 2 ? 'call' : 'talk';
    out.push({ id: u.id, text, life, sit, kind });
    spoke.set(u.id, now); lastAny = now;
    live = live.filter(t => t > now); live.push(now + life);
    if (sit) count[sit] = (count[sit] ?? 0) + 1;
  }

  /** 후보 하나를 말풍선으로 (확률·간격·자리 검사). force = 꼭 말함 (예약된 시작·끝 말) */
  function tryCand(out: TalkBubble[], c: Cand, now: number, force = false): boolean {
    const def = SITS[c.sit];
    if (!force) {
      live = live.filter(t => t > now);
      recent = recent.filter(t => now - t < 60000);
      const pace = PACE[def.prio], budget = big() ? PER_MIN.big : F!.party.length >= 10 ? PER_MIN.raid : PER_MIN.small;
      if (live.length >= pace.live || now - lastAny < pace.gap * (big() ? 1.3 : 1)) return false;
      if (recent.length >= budget + (def.prio === 3 ? 2 : 0)) return false;
      if (rand() >= chance(c.sit)) return false;
    }
    const u = speakerFor(c, now, force);
    if (!u || out.some(b => b.id === u.id)) return false;
    const text = lineFor(c, u);
    if (!text) return false;
    say(out, u, text, c.sit, now);
    if (!force) { recent.push(now); said.set(u.id, (said.get(u.id) ?? 0) + 1); }
    return true;
  }

  // ---------- 매 프레임 ----------
  /** 이번 프레임 사건(F.events)과 상태 변화를 보고 말풍선을 돌려줌. F.events를 비우기 전에 부름 */
  function frame(f: Fight, now: number, o: { pulling: boolean; paused: boolean }): TalkBubble[] {
    const out: TalkBubble[] = [];
    if (f !== F) return out;
    const cands: Cand[] = [];
    const add = (sit: TalkSit, u?: Unit, ally?: Unit) => cands.push({ sit, u, ally });
    const byId = (id: number) => f.party.find(x => x.id === id);

    // 엔진 말풍선: 신호(실수 신호·도망·삐짐·고집 …)는 꼭 보여 주고 상황에 맞는 대사로 바꿈. 감사·신중파 회피는 다른 말처럼 빈도 제한
    const soft: Cand[] = [];
    for (const ev of f.events) {
      if (ev.type !== 'bark' || !ev.text) continue;
      const u = byId(ev.id);
      if (!u || out.some(b => b.id === u.id)) continue;
      if (ev.sit && SOFT_BARKS.includes(ev.sit)) { soft.push({ sit: ev.sit, u }); continue; }
      const text = ev.sit ? lineFor({ sit: ev.sit }, u) : null;
      say(out, u, text || ev.text, ev.sit ?? null, now);
    }

    // 예약된 말 (시작 인사 · 끝 인사)
    if (!o.paused) {
      const due = queue.filter(q => q.at <= now);
      queue = queue.filter(q => q.at > now);
      for (const q of due) tryCand(out, q.c, now, true);
    }
    if (st.pulling && !o.pulling && !st.over && rand() < SITS.go.chance) tryCand(out, { sit: 'go' }, now, true);
    st.pulling = o.pulling;

    if (!st.over && !o.paused && !o.pulling) { cands.push(...soft); collect(f, now, add); }

    // 끝: 승리·패배 한마디 둘 (두 번째는 조금 뒤)
    const over = f.events.find((e): e is Extract<FightEvent, { type: 'over' }> => e.type === 'over');
    if (over && !st.over) {
      st.over = true; queue = [];
      lastLost = over.result === 'lose';
      const sit = endSit(f, over.result);
      tryCand(out, { sit }, now, true);
      if (rand() < 0.5) queue.push({ at: now + 400, c: { sit } });
      return out;
    }

    // 우선순위 높은 것부터 (같은 순위는 섞어서), 프레임당 1개
    cands.sort((a, b) => SITS[b.sit].prio - SITS[a.sit].prio || rand() - 0.5);
    for (const c of cands) if (tryCand(out, c, now)) break;
    return out;
  }

  function endSit(f: Fight, result: 'win' | 'lose'): TalkSit {
    const deaths = f.party.filter(u => !u.me && !u.alive).length;
    if (result === 'win') {
      if (info.seg < info.segN - 1) return 'segWin';
      return f.stats.deaths === 0 && deaths === 0 ? 'winClean' : deaths >= 2 ? 'winClose' : 'win';
    }
    if (!f.me.alive) return 'loseHealer';
    return f.bossMax > 0 && f.bossHp / f.bossMax < 0.1 ? 'loseClose' : 'lose';
  }

  /** 사건·상태 변화 → 상황 후보 */
  function collect(f: Fight, now: number, add: (sit: TalkSit, u?: Unit, ally?: Unit) => void): void {
    const t = f.t;
    const byId = (id: number) => f.party.find(x => x.id === id);
    const healedNow = new Map<number, Extract<FightEvent, { type: 'heal' }>>();
    const barked = new Set(f.events.filter(e => e.type === 'bark').map(e => (e as { id: number }).id));

    for (const ev of f.events) {
      const u = 'id' in ev ? byId(ev.id) : undefined;
      switch (ev.type) {
        case 'heal': if (u && !u.me) { healedNow.set(u.id, ev); const s = us.get(u.id); if (s) s.lastHeal = t; } break;
        case 'death':
          if (!u || u.me) break;
          add('selfDown', u);
          add(u.role === 'tank' ? 'tankDown' : 'allyDown', u, u);
          break;
        case 'revive': if (u && !u.me) add('allyRevived', u, u); break;
        case 'dispel': if (u && !u.me) add(ev.trap ? 'trapPop' : 'dispelled', ev.trap ? undefined : u); break;
        case 'cure': if (u && !u.me && ![...(us.get(u.id)?.jails.values() ?? [])].includes(ev.name)) add('cured', u); break; // 감옥이 깨진 건 jailFree
        case 'bossHeal': add('bossHeal'); break;
        case 'beacon': if (u && !u.me) add('beaconOn', u); break;
        case 'gauge': add('gauge'); break;
        case 'aheal': if (u && !u.me) add('aheal', u); break;
        case 'hurt': if (u && !u.me) add('invertHurt', u); break;
        case 'ability': {
          if (!u || u.me || !u.ab) break;
          const k = ABILITIES[u.ab.key]?.kind;
          if (k) add(({ def: 'abDef', heal: 'abHeal', sup: 'abSup', ctl: 'abCtl', atk: 'abAtk' } as const)[k], u);
          break;
        }
        case 'item': if (ev.key === 'mana' || ev.key === 'medit') add('manaPot'); break;
        case 'mobDown': {
          const m = f.mobs.find(x => x.id === ev.id);
          if (m?.add) { if (m.add.job?.p !== 'jail') add('addDown'); }
          else {
            const left = f.mobs.filter(x => x.alive && !x.add).length;
            add(left === 1 ? 'lastMob' : 'mobDown');
          }
          break;
        }
        case 'phase':
          if (ev.text === '광폭화') { if (!st.enraged) { st.enraged = true; add('enraged'); } }
          else if ((count.phase ?? 0) < 4) add('phase');
          break;
        case 'impact':
          if (ev.kind === 'aoe') add('aoeHit');
          if (ev.kind === 'buster' && f.party.some(x => x.role === 'tank' && x.alive)) add('busterOk');
          break;
      }
    }

    // 힐 받은 사람: 사람마다 가장 맞는 상황 하나
    if (healedNow.size >= 3) add('groupHeal');
    for (const [id, ev] of healedNow) {
      const u = byId(id)!, s = us.get(id);
      if (!s) continue;
      const r = ratio(u);
      if (ev.eff >= u.max * 0.4) add('bigHeal', u);
      else if (ev.crit) add('healCrit', u);
      else if (s.ratio >= 0.95 && ev.eff < ev.amt * 0.25) add('overheal', u);
      else if (r > s.ratio) add('healed', u);
    }
    // 시샘: 다른 사람이 힐 받는데 나는 오래 못 받음 (한 프레임에 한 명만)
    if (healedNow.size) {
      const j = f.party.find(u => !u.me && u.alive && !healedNow.has(u.id) && ratio(u) < 0.8 && t - (us.get(u.id)?.lastHeal ?? 0) > 8);
      if (j) add('jealous', j);
    }

    // 장판 예고: 새로 생긴 것 · 끝난 것
    const nowTels = new Set(f.tels.map(x => x.id));
    for (const tel of f.tels) {
      if (tels.has(tel.id)) continue;
      const was = new Set(f.party.filter(u => u.alive && !u.me && tel.cells.has(u.cell)).map(u => u.id));
      tels.set(tel.id, { kind: tel.kind, cells: tel.cells, safe: !!tel.safe, was });
      if (tel.kind === 'buster') add('buster');
      else if (tel.kind === 'aoe') add('aoeWarn');
      if (tel.safe) add('safeCall');
    }
    for (const [id, seen] of tels) {
      if (nowTels.has(id)) continue;
      tels.delete(id);
      if (seen.kind === 'zone' || seen.safe) {
        for (const u of f.party) {
          if (u.me || !u.alive) continue;
          if (seen.cells.has(u.cell)) add('zoneHit', u);
          else if (seen.was.has(u.id)) add('dodgeOk', u);
        }
        if (seen.safe && f.party.every(u => u.alive || u.me)) add('safeOk');
      }
    }

    // 파티원 상태 변화
    const alive = f.party.filter(u => u.alive && !u.me);
    let threat = f.tels.length > 0 || f.zones.length > 0;
    for (const u of f.party) {
      if (u.me) continue;
      const s = us.get(u.id);
      if (!s) continue;
      const r = ratio(u);
      if (!u.alive) { s.alive = false; s.ratio = 0; continue; }
      if (!s.alive) { Object.assign(s, snap(u, now)); s.lastHeal = t; continue; } // 부활
      if (r < 0.5) threat = true;
      // 체력 선
      s.hist.push([now, r]); s.hist = s.hist.filter(h => now - h[0] <= 600);
      const top = Math.max(...s.hist.map(h => h[1]));
      if (top - r >= 0.35 && now - s.hurtAt > 4000) { s.hurtAt = now; add('hurtBig', u); }
      if (r < 0.1 && !s.marks[10]) { s.marks[10] = true; add('low10', u); }
      else if (r < 0.25 && !s.marks[25]) { s.marks[25] = true; add('low25', u); }
      else if (r < 0.5 && !s.marks[50]) { s.marks[50] = true; add('low50', u); }
      if (r > 0.65) s.marks[50] = false;
      if (r > 0.45) { s.marks[25] = false; s.marks[10] = false; }
      s.low = Math.min(s.low, r);
      if (r >= 0.6 && s.low < 0.25) { add(s.low < 0.1 && r >= 0.5 ? 'clutch' : 'saved', u); s.low = r; }
      else if (r >= 0.999 && s.low < 0.5) { add('fullHp', u); s.low = r; }
      else if (r >= 0.999) s.low = r;
      // 힐 못 받음
      if (r < 0.6 && t - s.lastHeal > 10 && t - s.noHealAt > 25 && u.pers !== '관심종자') { s.noHealAt = t; add('noHeal', u); }
      // 보호막·생존기·지속 힐
      const shield = u.shield > 0, guard = u.guardian > 0 || u.redu > 0 || u.sacr > 0, immune = u.immune > 0, hots = hotCount(u);
      if (shield && !s.shield) add('shieldOn', u);
      if (immune && !s.immune) add('immuneOn', u);
      else if (guard && !s.guard) add('guardOn', u);
      if (hots > s.hots) add('hotOn', u);
      if (u.pulled && !s.pulled) add('pulled', u);
      if (!u.sulking && s.sulking) add('sulkEnd', u);
      if (!u.fleeing && s.fleeing) add('fleeBack', u);
      // 피함 (엔진이 이미 말한 사람은 빼고) · 마법사 이동
      if (u.moving && !s.moving && !u.fleeing && !barked.has(u.id)) {
        const danger = f.tels.some(x => x.cells.has(s.cell)) || f.zones.some(z => z.cells.has(s.cell));
        if (u.cls === 'mage' && rand() < 0.5) add('castMove', u);
        else if (danger) add('dodge', u);
      }
      // 바닥 위에 서 있음
      const inZone = f.zones.some(z => z.cells.has(u.cell));
      if (inZone) { if (s.zoneSince == null) s.zoneSince = t; else if (t - s.zoneSince > 1) { add('zoneStand', u); s.zoneSince = t + 6; } }
      else s.zoneSince = null;
      // 궁수 조준
      if (u.cls === 'archer') { if (u.aim >= 25 && !s.aimFull) { s.aimFull = true; add('aimFull', u); } else if (u.aim < 5) s.aimFull = false; }
      // 쫄이 날 노림 (부탱커가 끄는 쫄·감옥 빼고) · 자폭 쫄이 날 노림 (나올 때·대상이 바뀔 때)
      const on = u.role !== 'tank' && f.mobs.some(m => m.alive && m.add && m.add.on === u.id && m.add.job?.p !== 'jail' && m.add.job?.p !== 'fixate');
      if (on && !s.addOn) add('addOnMe', u);
      s.addOn = on;
      const fixed = f.mobs.some(m => m.alive && m.add?.job?.p === 'fixate' && m.add.on === u.id);
      if (fixed && !s.fixed) add('fixate', u);
      s.fixed = fixed;
      // 디버프: 새로 걸린 것 (기믹 디버프는 그 이름으로, 나머지는 해제 종류로)
      for (const d of u.debuffs) {
        if (!s.debs.has(d.id)) {
          s.debs.set(d.id, t);
          if (d.jail) { s.jails.set(d.id, d.name); add('jailed', u); add('jailOther', u, u); }
          else if (d.invert) add('invertOn', u);
          else if (d.trap) add('trapMark', u);
          else if (d.cureAt != null && d.cureAt >= 1) add('fullMark', u);
          else if (d.grow) add('woundMark', u);
          else if (d.untilBossLoss != null) { add('swallowed', u); add('swallowedOther', u, u); }
          else if (d.noDps) add('noDps', u);
          else if (d.healCut) add('healCut', u);
          else if (d.maxCut) add('maxCut', u);
          else if (!d.stackMax) {
            const k = ({ '마법': 'debMagic', '독': 'debPoison', '질병': 'debDisease', '저주': 'debCurse' } as const)[d.type as '마법'];
            if (k) add(k, u);
          }
        } else if (d.stackMax && (d.stack ?? 1) >= 3 && !s.debLong.has(-d.id)) { s.debLong.add(-d.id); add('burstStack', u); }
        else if (!d.lock && !d.trap && t - s.debs.get(d.id)! > 7 && !s.debLong.has(d.id)) { s.debLong.add(d.id); add('debLong', u); }
      }
      for (const id of s.debs.keys()) if (!u.debuffs.some(d => d.id === id)) { s.debs.delete(id); if (s.jails.delete(id)) add('jailFree', u); }
      Object.assign(s, { ratio: r, alive: true, shield, guard, immune, hots, pulled: !!u.pulled, sulking: u.sulking, fleeing: u.fleeing, moving: !!u.moving, cell: u.cell });
    }

    // 판·보스 상태 변화
    // 판에 나오는 적 (35 3-I): 새로 나온 것은 하는 일마다 상황 하나 · 잡지 않았는데 사라진 것 (폭탄 터짐 · 보스에 흡수)
    const killed = new Set(f.events.filter(e => e.type === 'mobDown').map(e => (e as { id: number }).id));
    let plain = false;
    for (const m of f.mobs) {
      const a = m.add;
      if (!a) continue;
      const p = a.job?.p;
      if (m.alive && !st.adds.has(m.id)) {
        st.adds.add(m.id);
        const on = byId(a.on);
        if (p === 'jail') continue; // 갇힌 사람 디버프로 말함
        if (p === 'fixate') { if (!on || on.me) plain = true; } // 파티원을 노리면 그 사람이 말함 (위)
        else if (p === 'mend') add('mendAdd');
        else if (p === 'bomb') add('bomb');
        else if (p === 'pylon') add('pylon');
        else if (p === 'smash') add('eliteAdd', on);
        else if (p === 'march') add('marchAdd');
        else if (a.cleave) add('swarm');
        else if (on?.role === 'tank') add('offTank', on); // 레이드: 부탱커가 끌고 감
        else plain = true;
      } else if (!m.alive && st.liveAdds.has(m.id) && !killed.has(m.id)) {
        if (p === 'bomb') add('bombBoom');
        else if (p === 'march') add('marchIn');
      }
    }
    st.liveAdds = new Set(f.mobs.filter(m => m.add && m.alive).map(m => m.id));
    if (plain) add('adds');
    const h = holes(f);
    if (h > st.holes) add('holeOpen');
    st.holes = h;
    if (f.invuln !== st.invuln) { add(f.invuln ? 'inter' : 'interEnd'); st.invuln = f.invuln; }
    if (f.rats.length > 0 && !st.rats) add('rats');
    st.rats = f.rats.length > 0;
    if (f.order && !st.order) { const o = f.order.ids.map(byId).filter((x): x is Unit => !!x && x.alive); if (o.length) add('orderStart', o[Math.floor(rand() * o.length)]); st.orderWrong = 0; }
    if (f.order && f.order.wrong > st.orderWrong) { st.orderWrong = f.order.wrong; const w = byId(f.order.ids[f.order.i]); if (w) add('orderWrong', w); }
    st.order = !!f.order;
    const daze = !!f.daze && f.daze.until > t;
    if (daze && !st.daze) add('daze');
    st.daze = daze;
    const noTank = f.noTankAt != null;
    if (noTank && !st.noTank) add('noTank');
    if (!noTank && st.noTank) add('tankUp');
    st.noTank = noTank;
    if (f.enraged && !st.enraged) { st.enraged = true; add('enraged'); }
    if (!f.bodyHp && f.enc.enrage > 0 && !f.enraged && !st.enrageSoon && f.enc.enrage - t <= 20 && f.enc.enrage - t > 0) { st.enrageSoon = true; add('enrageSoon'); }
    if (!f.bodyHp && f.bossMax > 0) {
      const b = f.bossHp / f.bossMax;
      for (const [mark, sit] of [[5, 'boss5'], [20, 'boss20'], [50, 'boss50']] as const) {
        if (b * 100 < mark && !st.boss.has(mark)) { for (const m of [5, 20, 50]) if (m >= mark) st.boss.add(m); add(sit); break; }
      }
    }
    if (t >= 180 && !st.long) { st.long = true; add('longFight'); }
    // 힐러 마나·체력
    if (f.mana < 10 && !st.mana.empty) { st.mana.empty = st.mana.low = true; add('manaEmpty'); }
    else if (f.mana < 30 && !st.mana.low) { st.mana.low = true; add('manaLow'); }
    if (f.mana > 50) st.mana.low = st.mana.empty = false;
    const me = ratio(f.me);
    if (f.me.alive && me < 0.4 && !st.healerLow) { st.healerLow = true; add('healerLow'); threat = true; }
    if (me > 0.7) st.healerLow = false;
    // 공대 쿨기
    const raid = (f.stats.casts.hymn ?? 0) + (f.stats.casts.quietwood ?? 0) + (f.stats.casts.sanctuary ?? 0);
    if (raid > st.raidCasts) add('raidCd');
    st.raidCasts = raid;
    // 파티 전체
    if (alive.length >= 2 && alive.filter(u => ratio(u) < 0.5).length * 2 > alive.length && t - st.partyLowAt > 20) { st.partyLowAt = t; add('partyLow'); }
    if (alive.length >= 2 && alive.every(u => ratio(u) >= 0.9)) {
      if (st.fullSince == null) st.fullSince = t;
      else if (t - st.fullSince > 15 && t - st.allFullAt > 45) { st.allFullAt = t; add('allFull'); }
    } else st.fullSince = null;
    if (alive.length === 1 && f.party.length >= 4 && !st.lastStand) { st.lastStand = true; add('lastStand', alive[0]); }
    // 딜미터 1등
    if (t > 20 && t - st.leaderAt > 2) {
      st.leaderAt = t;
      const lead = alive.reduce<Unit | null>((a, u) => (!a || u.dealt > a.dealt ? u : a), null);
      if (lead && lead.dealt > 0 && lead.id !== st.leader) { if (st.leader) add('meterTop', lead); st.leader = lead.id; }
    }
    // 잡담: 한동안 조용하고 다들 괜찮을 때
    if (threat || f.party.some(u => !u.me && !u.alive)) st.threatAt = t;
    if (t - st.idleAt > 8 && t - st.threatAt > 8 && now - lastAny > 20000 && alive.every(u => ratio(u) >= 0.7)) { st.idleAt = t; add('idle'); }
  }

  return { start, frame };
}

export type Talk = ReturnType<typeof createTalk>;
