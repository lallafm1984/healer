// 문장 끝 「~요」를 뺀 앱 문구에 맞춰 메시지 글자만 바꿈 (동작은 프로토타입 그대로, 2026-10-07)
/* ===== 나혼자 힐러 전투 엔진 (sim/combat_sim.py 이식 + 04 파티원 AI) ===== */
const Engine = (() => {
  const DT = 0.05;
  const SQ3 = Math.sqrt(3);

  function rngFrom(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 난이도 (기획서 부록 A, 04 2-2)
  const DIFFS = {
    '쉬움': { dmg: 0.8, dodge: 0.95, react: 0.7 },
    '보통': { dmg: 1.0, dodge: 0.85, react: 1.0 },
    '어려움': { dmg: 1.2, dodge: 0.75, react: 1.2 },
    '악몽': { dmg: 1.4, dodge: 0.65, react: 1.4 },
  };
  const MYTHIC = { party: 1.15, bossHp: 1.3 };

  // 장비 (08 4-2, sim gear_stats)
  const GRADE = { '없음': [0, 0], '일반': [0.02, 0], '고급': [0.04, 1], '희귀': [0.06, 2], '영웅': [0.08, 3], '전설': [0.10, 3] };
  const GEARS = {
    none: { label: '장비 없음', g: '없음', u: 0 },
    adv0: { label: '고급 +0', g: '고급', u: 0 },
    rare5: { label: '희귀 +5', g: '희귀', u: 5 },
    epic5: { label: '영웅 +5', g: '영웅', u: 5 },
  };
  function gearStats(id) {
    const { g, u } = GEARS[id];
    const [h, s] = GRADE[g];
    const n = (6 * s) / 3;
    return { heal: g === '없음' ? 1 : 1 + 6 * (h + 0.005 * u), regen: 1 + 0.03 * n, haste: 0.02 * n, crit: 0.05 + 0.02 * n };
  }

  // 성격 (04 6장 중 10종)
  const CATS = { '회피': '#7FA3BD', '위치': '#A3B46A', '관계': '#D68FA6', '감정': '#DB9B57' };
  const PERS = {
    '신중파': { star: 1, cat: '회피', ch: '신', react: 0.5, dodge: 0.10, dps: 0.9, desc: '가장 먼저 피함. 딜은 조금 약함', barks: ['조심!', '다음 패턴 피해'] },
    '딜 욕심쟁이': { star: 2, cat: '회피', ch: '딜', react: 1.8, dodge: -0.15, dps: 1.2, greedy: true, desc: '예고가 끝나기 직전까지 딜하다 늦게 피함', barks: ['한 대만 더!', '딜 1등 찍었다 ㅋ'] },
    '고집불통': { star: 2, cat: '회피', ch: '고', stubborn: 0.4, desc: '최대 체력 40% 이상 피해가 아니면 장판을 안 피함', barks: ['안 움직여', '원래 이렇게 하는 거임'] },
    '덜렁이': { star: 3, cat: '회피', ch: '덜', dodge: -0.10, wrongWay: 0.10, noTank: true, desc: '가끔 장판 안으로 들어감', barks: ['어? 여기 아니야?', '어 이거 밟으면 안 되는 거였음?'] },
    '허세꾼': { star: 3, cat: '회피', ch: '허', brave: 0.7, desc: '체력 70% 이상이면 장판을 안 피함', barks: ['안 아파!', '이 정도쯤이야'] },
    '외톨이': { star: 1, cat: '위치', ch: '외', dist: -1, desc: '아군과 떨어진 칸에 섬. 광역 힐 범위 밖', barks: ['…'] },
    '사교형': { star: 1, cat: '위치', ch: '사', dist: 1, desc: '아군 옆에 붙음. 광역 힐 효율 좋음', barks: ['같이 가자!', '다들 모여~'] },
    '관심종자': { star: 3, cat: '관계', ch: '관', attention: 12, desc: '12초 동안 힐을 못 받으면 삐져서 딜 -25%', barks: ['힐러님 나 안 보여?', '나도 좀 봐줘…'] },
    '감사형': { star: 1, cat: '관계', ch: '감', thanks: true, desc: '힐을 받으면 3초간 딜 +10%', barks: ['ㄱㅅㄱㅅ', '덕분에 살았다!'] },
    '겁쟁이': { star: 3, cat: '감정', ch: '겁', flee: 0.5, noTank: true, desc: '체력 50% 아래면 뒷줄로 도망가 딜 중단, 80%면 복귀', barks: ['으악 도망!', '나 빠질게 무서워'] },
  };
  const NICKS = ['장판요정', '딜미터1등', '말없는탱', '칼날', '감자도적', '새벽세시', '고인물', '버스기사', '닉값함', '퇴근각', '만렙꿈나무', '냥냥펀치', '불꽃남자', '얼음공주', '컨트롤장인', '딜뽕', '오늘만산다', '회피의신', '맞고보자', '탱하기싫다', '원딜장인', '활쏘는곰', '초코우유', '늦잠왕', '야근요정', '방패든양', '도끼든토끼', '별빛궁수'];

  // 판 (기획서 3-1): 행마다 열 번호 (odd-r 육각 배치)
  const BOARDS = {
    b10: [[1, 2, 3], [0, 1, 2, 3], [1, 2, 3]],
    b19: [[1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3, 4], [0, 1, 2, 3], [1, 2, 3]],
    b30: [[0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5]], // 20인 판 = 가로형 확정 (Lim 2026-10-07)
  };

  const ENCOUNTERS = {
    warden: { key: 'warden', lowLevel: true, name: '녹슨 문지기', tier: '던전 · 5인', board: 'b10', comp: { tank: 1, melee: 1, ranged: 2 }, hp: 7000, enrage: 270, manaCoef: 1.0, diffs: ['쉬움', '보통', '어려움', '악몽'], script: 'warden', stage: 0.25 },
    plague: { key: 'plague', name: '역병 군주', tier: '레이드 · 10인', board: 'b19', comp: { tank: 2, melee: 3, ranged: 4 }, hp: 22000, enrage: 390, manaCoef: 1.3, diffs: ['쉬움', '보통', '어려움'], script: 'plague', stage: 0.18 },
    plague20: { key: 'plague20', name: '역병 군주', tier: '레이드 악몽 · 20인', board: 'b30', comp: { tank: 2, melee: 7, ranged: 10 }, hp: 48000, enrage: 450, manaCoef: 1.6, diffs: ['악몽'], script: 'plague', big: true, stage: 0.13 },
  };

  // 사제 스킬 (06 3장)
  const SKILLS = {
    heal: { name: '치유', short: '치유', cast: 1.8, cost: 3, amt: 300, target: 'ally', gp: 20 },
    flash: { name: '순간 치유', short: '순간', cast: 1.0, cost: 6, amt: 250, target: 'ally', gp: 15 },
    renew: { name: '소생', short: '소생', cast: 0, cost: 3, target: 'ally', gp: 5, gs: 5 },
    poh: { name: '치유의 기원', short: '기원', cast: 2.0, cost: 10, amt: 180, target: 'area', gs: 35 },
    purify: { name: '정화', short: '정화', cast: 0, cost: 4, cd: 8, target: 'ally' },
    guardian: { name: '수호 영혼', short: '수호', cast: 0, cost: 2, cd: 90, target: 'ally' },
    hymn: { name: '천상의 찬가', short: '찬가', cast: 0, channel: 4, cost: 15, cd: 180, target: 'none' },
    serenity: { name: '성언: 평온', short: '평온', cast: 0, cost: 0, amt: 600, target: 'ally' },
    sanctify: { name: '성언: 신성화', short: '신성화', cast: 0, cost: 0, amt: 300, target: 'area' },
  };
  const DISPELLABLE = { '질병': true, '마법': true };

  // ---------- 판 ----------
  function makeCells(def) {
    const cells = [];
    def.forEach((cols, row) => cols.forEach(col => {
      const q = col - (row - (row & 1)) / 2;
      cells.push({ i: cells.length, col, row, q, r: row, px: SQ3 * (col + 0.5 * (row & 1)), py: 1.5 * row, unit: null });
    }));
    return cells;
  }
  const hexDist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

  // ---------- 전투 소비 아이템 (19 2부) ----------
  // 물약 = 나에게, 공용 쿨 60초 / 두루마리 = 전투당 횟수만. GCD와 무관 (MMO 물약 단축키처럼)
  const ITEMS = {
    mana: { name: '마나 물약', short: '마나', kind: 'potion', uses: 1, target: 'self', desc: '마나 +30% 즉시', tip: '급할 때 바로 마나를 채워요' },
    medit: { name: '명상의 물약', short: '명상', kind: 'potion', uses: 1, target: 'self', desc: '20초간 마나 재생 ×2.5', tip: '느리지만 총량은 마나 물약보다 많아요' },
    life: { name: '생명 물약', short: '생명', kind: 'potion', uses: 2, target: 'self', desc: '내 체력 40% 회복', tip: '내가 쓰러지면 바로 패배예요' },
    cleanse: { name: '해제 두루마리', short: '해제', kind: 'scroll', uses: 1, target: 'none', desc: '모든 파티원의 디버프 1개씩 제거 (독 포함, 함정 제외)', tip: '사제가 못 지우는 독도 지워요' },
    shield: { name: '보호 두루마리', short: '보호', kind: 'scroll', uses: 1, target: 'ally', desc: '칸 1개, 8초간 받는 피해 -40%', tip: '누른 뒤 칸을 탭해요. 버스터 직전 탱커에게' },
    feather: { name: '부활 깃털', short: '깃털', kind: 'scroll', uses: 1, target: 'dead', desc: '쓰러진 파티원 1명을 체력 30%로 (탱커 우선, 그다음 가장 최근)', tip: '딜러를 살려 광폭화를 피하거나 레이드 탱커를 다시 세워요' },
  };
  const POTION_CD = 60;

  // ---------- 전투 생성 ----------
  function create(cfg) {
    const enc = ENCOUNTERS[cfg.encounter];
    const diff = DIFFS[cfg.diff];
    const rng = rngFrom(cfg.seed || 1);
    const gear = gearStats(cfg.gear || 'none');
    const board = cfg.board && BOARDS[cfg.board] && BOARDS[cfg.board].flat().length === BOARDS[enc.board].flat().length ? cfg.board : enc.board;
    const cells = makeCells(BOARDS[board]);
    const rows = BOARDS[board].length;
    const mythic = cfg.diff === '악몽';
    const f = {
      board,
      cfg, enc, diff, rng, gear, cells, rows, mythic,
      t: 0, k: 0, over: null, reason: '',
      dmgMult: diff.dmg,
      bossMax: enc.hp * (mythic && !enc.big ? MYTHIC.bossHp : 1),
      mana: 100, gcd: 0, cast: null, channel: 0, chTick: 0, queued: null,
      cd: { purify: 0, guardian: 0, hymn: 0 },
      g: { p: 0, s: 0 }, symbolUsed: false, symbol: 0,
      skills: [], tels: [], zones: [], events: [], phase: 1, phaseName: '', invuln: false,
      enraged: false, dpsAcc: 0, rats: [],
      items: {}, potCd: 0, medit: 0, itemLog: [],
      stats: { healed: 0, overheal: 0, deaths: 0, minMana: 100, dispels: 0, dispellable: 0, trapPops: 0, queueLost: 0, casts: {}, taps: 0, missTaps: 0, emptyTaps: 0, cancels: 0, manaFails: 0, hymnBroken: 0 },
      nextId: 1,
    };
    f.bossHp = f.bossMax;
    for (const k of (cfg.items || []).slice(0, 4)) if (ITEMS[k]) f.items[k] = ITEMS[k].uses;
    f.gcdBase = 1 / (1 + gear.haste);
    makeParty(f, cfg.party);
    SCRIPTS[enc.script].init(f);
    return f;
  }

  function rollParty(encKey, seed) {
    const enc = ENCOUNTERS[encKey];
    const rng = rngFrom(seed);
    const pick = arr => arr[Math.floor(rng() * arr.length)];
    const nicks = NICKS.slice();
    for (let i = nicks.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [nicks[i], nicks[j]] = [nicks[j], nicks[i]]; }
    const all = Object.keys(PERS);
    const low = !!enc.lowLevel; // 04 6-F: 저레벨 던전은 탱커 ★ 성격만, ★★★ 파티당 최대 1명
    let hard = 0;
    const choose = role => {
      let pool = all.filter(p => !(role === 'tank' && PERS[p].noTank));
      if (low && role === 'tank') pool = pool.filter(p => PERS[p].star === 1);
      if (low && hard >= 1) pool = pool.filter(p => PERS[p].star < 3);
      const p = pick(pool);
      if (PERS[p].star === 3) hard++;
      return p;
    };
    const list = [];
    for (let i = 0; i < enc.comp.tank; i++) list.push({ role: 'tank', pers: choose('tank'), nick: nicks.pop() });
    for (let i = 0; i < enc.comp.melee; i++) list.push({ role: 'melee', pers: choose('melee'), nick: nicks.pop() });
    for (let i = 0; i < enc.comp.ranged; i++) list.push({ role: 'ranged', pers: choose('ranged'), nick: nicks.pop() });
    return list;
  }

  function zoneOf(f, row) {
    const x = f.rows === 1 ? 0 : row / (f.rows - 1);
    return x < 0.34 ? 'front' : x > 0.66 ? 'back' : 'mid';
  }
  const ZONE_PREF = {
    tank: { front: 70, mid: 0, back: -40 },
    melee: { front: 20, mid: 15, back: -10 },
    ranged: { front: -10, mid: 5, back: 20 },
    healer: { front: -30, mid: 5, back: 25 },
  };
  function adjAllies(f, cell, self) {
    let n = 0;
    for (const c of f.cells) if (c.unit && c.unit !== self && c.unit.alive && hexDist(c, cell) === 1) n++;
    return n;
  }
  function centerX(f) {
    let a = Infinity, b = -Infinity;
    for (const c of f.cells) { a = Math.min(a, c.px); b = Math.max(b, c.px); }
    return (a + b) / 2;
  }

  function makeParty(f, roster) {
    const mult = f.mythic ? MYTHIC.party : 1;
    const units = [];
    const add = (role, pers, nick) => {
      const base = (role === 'tank' ? 1000 : role === 'healer' ? 550 : 600) * mult;
      const dps = (role === 'tank' ? 4 : role === 'healer' ? 0 : 10) * mult;
      const u = {
        id: f.nextId++, role, pers, p: pers ? PERS[pers] : {}, nick, base, max: base, hp: base, dps, alive: true,
        cell: -1, home: -1, hot: 0, hotTick: 0, echo: [], guardian: 0, debuffs: [], moving: null, react: null,
        retryAt: 0, mistakeUntil: 0, wrongUntil: 0, fleeing: false, sulking: false, lastHeal: 0, thanks: 0, flash: 0,
        barkAt: -10, ignoreZone: 0, me: role === 'healer',
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
      let best = null, bs = -Infinity;
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
      best.unit = u; u.cell = best.i; u.home = best.i;
    }
  }

  // ---------- 공용 ----------
  const living = f => f.party.filter(u => u.alive);
  const cellOf = (f, u) => f.cells[u.cell];
  function emit(f, ev) { f.events.push(ev); }
  function bark(f, u, text, force) {
    if (!u.alive || u.me) return;
    if (!force && f.t - u.barkAt < 4) return;
    if (!force && f.rng() > 0.6) return;
    u.barkAt = f.t;
    emit(f, { type: 'bark', id: u.id, text: text || u.p.barks?.[Math.floor(f.rng() * u.p.barks.length)] || '' });
  }

  function heal(f, u, amt, direct) {
    if (!u.alive || amt <= 0) return 0;
    amt *= f.gear.heal;
    const crit = f.rng() < f.gear.crit;
    if (crit) amt *= 1.5;
    const eff = Math.min(amt, u.max - u.hp);
    u.hp += eff;
    f.stats.healed += eff;
    f.stats.overheal += amt - eff;
    if (direct) {
      emit(f, { type: 'heal', id: u.id, amt: Math.round(amt), eff: Math.round(eff), crit });
      u.lastHeal = f.t;
      if (u.sulking) { u.sulking = false; }
      if (u.p.thanks) { u.thanks = 3; if (f.rng() < 0.35) bark(f, u); }
    }
    return eff;
  }

  function damage(f, u, amt) {
    if (!u.alive || amt <= 0) return;
    amt *= f.dmgMult;
    if (u.shield > 0) amt *= 0.6;
    u.hp -= amt;
    if (amt > u.max * 0.15) u.flash = 0.35;
    if (u.hp <= 0) {
      if (u.guardian > 0) {
        u.guardian = 0;
        u.hp = u.max * 0.4;
        emit(f, { type: 'sound', name: 'bell' });
        emit(f, { type: 'msg', text: `수호 영혼이 ${u.nick}을(를) 살림` });
        return;
      }
      // 쓰러지면 칸을 비운다 → 다른 파티원이 그 칸으로 이동할 수 있음 (2026-10-07 Lim). 화면에는 흐린 흔적만 남김
      if (u.moving) { const to = f.cells[u.moving.to]; if (to.unit === u) to.unit = null; }
      { const here = f.cells[u.cell]; if (here.unit === u) here.unit = null; }
      u.alive = false; u.hp = 0; u.debuffs = []; u.hot = 0; u.echo = []; u.moving = null; u.react = null; u.shield = 0; u.diedAt = f.t;
      if (u.max < u.base) u.max = u.base;
      f.stats.deaths++;
      emit(f, { type: 'death', id: u.id });
      emit(f, { type: 'sound', name: 'death' });
    }
  }

  // ---------- 디버프 ----------
  function addDebuff(f, u, d) {
    const o = Object.assign({ id: f.nextId++ }, d);
    u.debuffs.push(o);
    if (DISPELLABLE[o.type] && !o.trap) f.stats.dispellable++;
    emit(f, { type: 'debuff', id: u.id, dtype: o.type });
    return o;
  }
  function randomTargets(f, n, filter) {
    const c = living(f).filter(filter || (() => true));
    for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(f.rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
    return c.slice(0, n);
  }

  // ---------- 이동 (04 5-1) ----------
  function dangerAt(f, idx, extra) {
    if (extra && extra.has(idx)) return true;
    for (const z of f.zones) if (z.cells.has(idx)) return true;
    for (const t of f.tels) if (t.kind === 'zone' && t.cells.has(idx)) return true;
    return false;
  }
  function pickCell(f, u, opts) {
    const cur = cellOf(f, u);
    let best = null, bs = -Infinity;
    for (const c of f.cells) {
      if (c.unit && c.unit !== u) continue;
      if (c.i === u.cell) continue;
      if (opts.safe && dangerAt(f, c.i, opts.extra)) continue;
      let s = 100;
      s += ZONE_PREF[u.role][zoneOf(f, c.row)] * (u.role === 'tank' ? 1 : 0.8);
      s += (u.p.dist || 0) * adjAllies(f, c, u) * 8;
      s -= 10 * hexDist(cur, c);
      if (opts.back) s += c.row * 40 - adjAllies(f, c, u) * 5;
      if (opts.home && c.i === u.home) s += 60;
      s += f.rng() * 2;
      if (s > bs) { bs = s; best = c; }
    }
    return best;
  }
  function moveTo(f, u, c) {
    if (!c) return false;
    const from = cellOf(f, u);
    const time = 0.4 * Math.max(1, hexDist(from, c));
    c.unit = u;
    u.moving = { from: from.i, to: c.i, left: time, total: time };
    return true;
  }
  function finishMove(f, u) {
    const m = u.moving;
    f.cells[m.from].unit = null;
    u.cell = m.to;
    u.moving = null;
  }

  // 장판 예고에 대한 반응 예약
  function scheduleReactions(f, tel) {
    for (const u of living(f)) {
      const pos = u.moving ? u.moving.to : u.cell;
      const inZ = tel.cells.has(pos);
      let rt = 0.8 * f.diff.react * (u.p.react || 1);
      if (u.me) rt = 0.6 * f.diff.react;
      if (inZ) {
        let at = f.t + rt;
        if (u.p.greedy) at = Math.max(at, tel.impact - 0.3);
        u.react = { at, tel: tel.id };
      } else if (u.p.wrongWay && f.rng() < u.p.wrongWay && !u.fleeing) {
        u.react = { at: f.t + rt, tel: tel.id, wrong: true };
        u.wrongUntil = f.t + rt;
      }
    }
  }
  function zoneThreat(f, tel) { return tel.dps * 2 * f.dmgMult; }

  function doReact(f, u) {
    const r = u.react; u.react = null;
    const tel = f.tels.find(t => t.id === r.tel) || f.zones.find(z => z.id === r.tel);
    if (!tel) return;
    if (r.wrong) {
      const free = f.cells.filter(c => !c.unit && tel.cells.has(c.i));
      if (free.length) { moveTo(f, u, free[Math.floor(f.rng() * free.length)]); bark(f, u, u.p.barks[1], true); }
      return;
    }
    if (u.p.stubborn && zoneThreat(f, tel) < u.p.stubborn * u.max) { u.ignoreZone = tel.id; bark(f, u, u.p.barks[0]); return; }
    if (u.p.brave && u.hp / u.max >= u.p.brave) { u.retryAt = f.t + 1; bark(f, u, u.p.barks[0]); return; }
    const rate = Math.max(0.05, Math.min(0.98, u.me ? f.diff.dodge + 0.1 : f.diff.dodge + (u.p.dodge || 0)));
    if (f.rng() < rate) {
      const c = pickCell(f, u, { safe: true, extra: tel.cells });
      if (c) { moveTo(f, u, c); if (u.pers === '신중파') bark(f, u); }
      else { bark(f, u, '피할 곳이 없어!', true); u.retryAt = f.t + 1.5; }
    } else {
      u.mistakeUntil = Math.max(f.t, (tel.impact || f.t) - 0.5) + 0.5;
      u.retryAt = (tel.impact || f.t) + 1.5 + f.rng() * 2.5;
      bark(f, u, null, true);
    }
  }

  // ---------- 보스 스크립트 ----------
  function skill(f, s) { const o = Object.assign({ active: () => true }, s); f.skills.push(o); return o; }
  function tankTarget(f) { return f.party.find(u => u.role === 'tank' && u.alive) || null; }

  const SCRIPTS = {
    warden: {
      init(f) {
        f.phaseName = '';
        skill(f, { key: 'auto', hidden: true, next: 2, period: 2, cast: 0, fire(f) { const tk = tankTarget(f); if (tk) damage(f, tk, 70 * (0.7 + 0.6 * f.rng())); } });
        skill(f, { key: 'buster', name: '내려찍기', icon: '찍기', kind: 'buster', next: 12, period: 20, cast: 2, warn: 'buster', dmg: 600,
          target(f) { const tk = tankTarget(f); return tk ? [tk.id] : []; },
          hit(f, tel) { for (const id of tel.units) { const u = f.party.find(x => x.id === id); if (u) damage(f, u, tel.skill.dmg); } } });
        skill(f, { key: 'aoe', name: '증기 분출', icon: '증기', kind: 'aoe', next: 25, period: 30, cast: 3, warn: 'aoe',
          hit(f) { for (const u of living(f)) damage(f, u, 220); } });
        f.zoneSkill = skill(f, { key: 'zone', name: '녹물 웅덩이', icon: '장판', kind: 'zone', next: Infinity, period: 20, cast: 2.5, dps: 60, dur: 8, warn: 'zone',
          active: f => f.bossHp <= f.bossMax * 0.4,
          cellsFor(f) {
            // 05 1-B: 던전에서는 "피할 곳이 없어!"가 나오지 않게, 범위 밖 빈 칸이 범위 안 인원 이상 남는 중심만 고른다
            const ok = randomTargets(f, 99).map(u => {
              const center = f.cells[u.cell];
              const set = new Set(f.cells.filter(x => hexDist(x, center) <= 1).map(x => x.i));
              const inside = living(f).filter(v => set.has(v.cell)).length;
              const free = f.cells.filter(x => !x.unit && !set.has(x.i)).length;
              return free >= inside ? set : null;
            }).filter(Boolean);
            if (ok.length) return ok[0];
            const c = randomTargets(f, 1)[0];
            return c ? new Set([c.cell]) : new Set();
          } });
      },
      update(f) {
        if (f.zoneSkill.next === Infinity && f.bossHp <= f.bossMax * 0.4) { f.zoneSkill.next = f.t + 3; emit(f, { type: 'phase', text: '녹이 흘러내린다' }); }
        if (!f.enraged && f.t >= f.enc.enrage) {
          f.enraged = true; emit(f, { type: 'phase', text: '광폭화' });
          skill(f, { key: 'enrage', name: '증기 폭주', icon: '광폭', kind: 'aoe', next: f.t, period: 2, cast: 1, hit(f) { for (const u of living(f)) damage(f, u, 220); } });
        }
      },
    },
    plague: {
      init(f) {
        const big = f.enc.big;
        const nDeb = big ? 4 : 2;
        f.phase = 1; f.phaseName = '1페이즈';
        skill(f, { key: 'auto', hidden: true, next: 2, period: 2, cast: 0, fire(f) { const tk = tankTarget(f); if (tk) damage(f, tk, 60 * (0.7 + 0.6 * f.rng())); } });
        skill(f, { key: 'breath', name: '썩은 숨결', icon: '숨결', kind: 'instant', next: 6, period: 12, cast: 0, active: f => f.phase === 1 || f.phase >= 2,
          fire(f) {
            for (const u of randomTargets(f, nDeb)) {
              let d = u.debuffs.find(x => x.name === '썩은 숨결');
              if (!d) d = addDebuff(f, u, { name: '썩은 숨결', type: '질병', left: 60, stack: 0 });
              d.stack = Math.min(4, d.stack + 1); d.left = 60;
              u.max = u.base * (1 - 0.05 * d.stack); u.hp = Math.min(u.hp, u.max);
            }
          } });
        skill(f, { key: 'sting', name: '독침', icon: '독침', kind: 'instant', next: 10, period: 15, cast: 0, active: f => f.phase === 1,
          fire(f) { for (const u of randomTargets(f, nDeb, u => !u.debuffs.some(d => d.name === '독침'))) addDebuff(f, u, { name: '독침', type: '독', left: 12, dot: 15 }); } });
        f.pulse = skill(f, { key: 'aoe', name: '역병 파동', icon: '파동', kind: 'aoe', next: 27, period: 30, cast: 3, warn: 'aoe', active: f => f.phase === 1 || f.phase >= 2,
          hit(f) { const dmg = f.phase === 1 ? 150 : 180; for (const u of living(f)) damage(f, u, dmg); } });
        f.contagion = skill(f, { key: 'contagion', name: '전염', icon: '전염', kind: 'instant', next: Infinity, period: 20, cast: 0, active: f => f.phase >= 2,
          fire(f) {
            const ts = randomTargets(f, big ? 2 : 1, u => !u.debuffs.some(d => d.name === '전염'));
            for (const u of ts) addDebuff(f, u, { name: '전염', type: '질병', left: 8, trap: true });
            if (ts.length === 2 && hexDist(cellOf(f, ts[0]), cellOf(f, ts[1])) === 1) {
              emit(f, { type: 'msg', text: '전염 대상이 붙어 있어 바로 터짐' });
              for (const u of ts) { const d = u.debuffs.find(x => x.name === '전염'); if (d) { u.debuffs = u.debuffs.filter(x => x !== d); spread(f, u); } }
            }
          } });
        f.storm = skill(f, { key: 'storm', name: '역병 폭풍', icon: '폭풍', kind: 'zone', next: Infinity, period: 10, cast: 2.5, dps: 40, dur: 7.5, warn: 'zone', active: f => f.phase === 3,
          cellsFor(f) {
            f.stormSide = !f.stormSide;
            const xs = f.cells.map(c => c.px);
            // 기획 05 2-E는 판 절반이지만, 30칸에 20명이면 피할 칸이 모자라 프로토타입은 바깥 1/3로 둔다
            const lo = Math.min(...xs), hi = Math.max(...xs), w = (hi - lo) / 3;
            return new Set(f.cells.filter(c => (f.stormSide ? c.px < lo + w : c.px > hi - w)).map(c => c.i));
          } });
      },
      update(f) {
        const big = f.enc.big;
        const r = f.bossHp / f.bossMax;
        if (f.phase === 1 && r <= 0.6) {
          f.phase = 0; f.phaseName = '인터미션'; f.invuln = true; f.interEnd = f.t + 25;
          emit(f, { type: 'phase', text: '인터미션: 쥐떼가 뒷줄 공격' });
          const ranged = living(f).filter(u => u.role === 'ranged').sort((a, b) => cellOf(f, b).row - cellOf(f, a).row);
          f.rats = ranged.slice(0, big ? 6 : 3).map(u => u.id);
          for (const u of living(f)) if (u.debuffs.length) addDebuff(f, u, { name: '독침', type: '독', left: 12, dot: 15 });
        }
        if (f.phase === 0) {
          for (const id of f.rats) { const u = f.party.find(x => x.id === id); if (u) damage(f, u, 30 * DT); }
          if (f.t >= f.interEnd) {
            f.phase = 2; f.phaseName = '2페이즈'; f.invuln = false; f.rats = [];
            f.contagion.next = f.t + 10; f.pulse.next = f.t + 22; f.pulse.period = 25;
            emit(f, { type: 'phase', text: '2페이즈: 전염은 해제하면 바로 퍼짐' });
          }
        }
        if (big && f.phase === 2 && r <= 0.3) {
          f.phase = 3; f.phaseName = '3페이즈'; f.storm.next = f.t + 1;
          emit(f, { type: 'phase', text: '3페이즈: 역병 폭풍이 판 바깥쪽을 번갈아 덮음' });
        }
        if (!f.enraged && f.t >= f.enc.enrage) {
          f.enraged = true; emit(f, { type: 'phase', text: '광폭화' });
          skill(f, { key: 'enrage', name: '역병 폭주', icon: '광폭', kind: 'aoe', next: f.t, period: 3, cast: 1, hit(f) { for (const u of living(f)) damage(f, u, 180); } });
        }
      },
    },
  };

  function spread(f, u) {
    const c = cellOf(f, u);
    emit(f, { type: 'sound', name: 'burst' });
    for (const v of living(f)) {
      if (v !== u && hexDist(cellOf(f, v), c) === 1) {
        damage(f, v, 150);
        if (v.alive) addDebuff(f, v, { name: '독침', type: '독', left: 12, dot: 15 });
      }
    }
  }
  function onDebuffEnd(f, u, d, dispelled) {
    if (d.name === '썩은 숨결') u.max = u.base;
    if (d.name === '전염') spread(f, u);
  }

  // ---------- 보스 진행 ----------
  function bossTick(f) {
    SCRIPTS[f.enc.script].update(f);
    for (const s of f.skills) {
      if (f.t + 1e-9 < s.next) continue;
      s.next += s.period;
      if (!s.active(f)) continue;
      if (s.cast <= 0) { s.fire(f); continue; }
      const tel = { id: f.nextId++, skill: s, kind: s.kind, start: f.t, impact: f.t + s.cast, units: s.target ? s.target(f) : [], cells: s.cellsFor ? s.cellsFor(f) : new Set(), dps: s.dps, dur: s.dur };
      f.tels.push(tel);
      if (s.warn) emit(f, { type: 'sound', name: s.warn });
      if (tel.kind === 'zone') scheduleReactions(f, tel);
    }
    for (const tel of f.tels.filter(t => t.impact <= f.t + 1e-9)) {
      if (tel.kind === 'zone') {
        f.zones.push({ id: tel.id, cells: tel.cells, end: f.t + tel.dur, dps: tel.dps });
      } else tel.skill.hit(f, tel);
      emit(f, { type: 'impact', kind: tel.kind });
    }
    f.tels = f.tels.filter(t => t.impact > f.t + 1e-9);
    f.zones = f.zones.filter(z => z.end > f.t);
  }

  // 화면 상단 기술 대기열: 다음 3개
  function queue(f) {
    const list = [];
    for (const t of f.tels) list.push({ name: t.skill.name, icon: t.skill.icon, kind: t.kind, impact: t.impact, start: t.start, casting: true });
    for (const s of f.skills) {
      if (s.hidden || s.next === Infinity) continue;
      let n = s.next;
      for (let i = 0; i < 3; i++) {
        const imp = n + s.cast;
        if (imp - f.t < 120 && s.active(f)) list.push({ name: s.name, icon: s.icon, kind: s.kind, impact: imp, casting: false });
        n += s.period;
      }
    }
    list.sort((a, b) => a.impact - b.impact);
    return list.slice(0, 3);
  }

  // ---------- 유닛 진행 ----------
  function unitTick(f, u) {
    const dt = DT;
    if (u.flash > 0) u.flash -= dt;
    if (!u.alive) return;
    if (u.hot > 0) { u.hot -= dt; u.hotTick += dt; if (u.hotTick >= 3 - 1e-9) { u.hotTick -= 3; heal(f, u, 80, false); } }
    for (const e of u.echo) { heal(f, u, e.rate * dt, false); e.left -= dt; }
    u.echo = u.echo.filter(e => e.left > 0);
    if (u.guardian > 0) u.guardian -= dt;
    if (u.shield > 0) u.shield -= dt;
    if (u.thanks > 0) u.thanks -= dt;
    for (const d of u.debuffs.slice()) {
      d.left -= dt;
      if (d.dot) damage(f, u, d.dot * dt);
      if (!u.alive) return;
      if (d.left <= 0) { u.debuffs = u.debuffs.filter(x => x !== d); onDebuffEnd(f, u, d, false); }
    }
    if (!u.alive) return;
    for (const z of f.zones) if (z.cells.has(u.cell)) damage(f, u, z.dps * dt);
    if (!u.alive) return;
    if (u.moving) { u.moving.left -= dt; if (u.moving.left <= 0) finishMove(f, u); }
    if (u.react && f.t >= u.react.at && !u.moving) doReact(f, u);
    if (f.k % 4 !== 0 || u.moving || u.react) return;
    // 0.2초마다 판단 (04 4장)
    const inZone = f.zones.find(z => z.cells.has(u.cell));
    if (inZone && u.ignoreZone !== inZone.id && f.t >= u.retryAt) {
      if (u.p.stubborn && inZone.dps * 2 * f.dmgMult < u.p.stubborn * u.max) { u.ignoreZone = inZone.id; }
      else if (u.p.brave && u.hp / u.max >= u.p.brave) { u.retryAt = f.t + 1; }
      else {
        const rate = Math.max(0.05, Math.min(0.98, u.me ? f.diff.dodge + 0.1 : f.diff.dodge + (u.p.dodge || 0)));
        if (f.rng() < rate) { const c = pickCell(f, u, { safe: true }); if (c) moveTo(f, u, c); else u.retryAt = f.t + 1.5; }
        else u.retryAt = f.t + 1.5 + f.rng() * 1.5;
      }
      return;
    }
    if (u.p.flee) {
      if (!u.fleeing && u.hp / u.max < u.p.flee) {
        const c = pickCell(f, u, { safe: true, back: true });
        if (c) { moveTo(f, u, c); u.fleeing = true; bark(f, u, u.p.barks[0], true); }
      } else if (u.fleeing && u.hp / u.max >= 0.8) {
        u.fleeing = false;
        const c = pickCell(f, u, { safe: true, home: true });
        if (c && hexDist(c, cellOf(f, u)) >= 1) moveTo(f, u, c);
      }
    }
    // 회피가 끝나면 원래 자리로 복귀 (04 3장 상태 머신). 신중파는 1초 더 기다림
    if (!u.fleeing && u.home >= 0 && u.cell !== u.home) {
      const h = f.cells[u.home];
      if (!h.unit && !dangerAt(f, u.home)) {
        if (u.homeAt == null) u.homeAt = f.t + 1 + (u.p.react && u.p.react < 1 ? 1 : 0);
        else if (f.t >= u.homeAt) { u.homeAt = null; moveTo(f, u, h); return; }
      } else u.homeAt = null;
    }
    if (u.p.attention && !u.sulking && f.t - u.lastHeal > u.p.attention && f.t > 8) { u.sulking = true; bark(f, u, null, true); }
  }

  function partyDps(f) {
    let s = 0;
    for (const u of f.party) {
      if (!u.alive || u.moving || u.fleeing || u.me) continue;
      let d = u.dps * (u.p.dps || 1);
      if (u.sulking) d *= 0.75;
      if (u.thanks > 0) d *= 1.1;
      s += d;
    }
    return s;
  }

  // ---------- 힐러 ----------
  function slotKey(f, slot) {
    if (slot === 'heal' && f.g.p >= 100) return 'serenity';
    if (slot === 'poh' && f.g.s >= 100) return 'sanctify';
    return slot;
  }
  function canTarget(f, key, cellIdx) {
    const sk = SKILLS[key];
    if (sk.target === 'none') return { ok: true };
    const c = f.cells[cellIdx];
    if (!c || !c.unit) return { ok: false, reason: '빈 칸' };
    const u = c.unit;
    if (!u.alive) return { ok: false, reason: `${u.nick}은(는) 쓰러짐` };
    if (key === 'purify' && !u.debuffs.some(d => DISPELLABLE[d.type])) return { ok: false, reason: '정화로 지울 디버프 없음' };
    return { ok: true, u };
  }
  function use(f, key, cellIdx, fromQueue) {
    if (f.over) return { ok: false };
    const sk = SKILLS[key];
    const tg = canTarget(f, key, cellIdx);
    if (!tg.ok) return tg;
    if (sk.cd && f.cd[key] > 0) return { ok: false, reason: `${sk.name} 재사용 대기 ${Math.ceil(f.cd[key])}초` };
    if (f.mana < sk.cost) { f.stats.manaFails++; return { ok: false, reason: '마나 부족' }; }
    const uid = tg.u ? tg.u.id : null;
    if (f.cast && f.cast.uid === uid && f.cast.key === key) return { ok: true, same: true };
    if (f.channel > 0) { f.channel = 0; f.stats.hymnBroken++; emit(f, { type: 'msg', text: '천상의 찬가 끊김' }); }
    if (f.cast) { f.cast = null; f.stats.cancels++; f.gcd = 0; } // 시전을 취소하고 새 대상으로 바꿀 때는 GCD를 돌려준다 (오탭 정정 비용 줄이기)
    if (f.gcd > 0) { f.queued = { key, uid }; return { ok: true, queued: true }; }
    exec(f, key, cellIdx, tg.u);
    return { ok: true };
  }
  function exec(f, key, cellIdx, u) {
    const sk = SKILLS[key];
    f.gcd = f.gcdBase;
    f.stats.casts[key] = (f.stats.casts[key] || 0) + 1;
    if (sk.cast > 0) {
      const tm = sk.cast / (1 + f.gear.haste);
      f.cast = { key, cell: cellIdx, uid: u.id, left: tm, total: tm };
      return;
    }
    if (sk.channel) {
      f.mana -= sk.cost; f.cd[key] = sk.cd; f.channel = sk.channel; f.chTick = 0;
      emit(f, { type: 'sound', name: 'hymn' });
      return;
    }
    f.mana -= sk.cost;
    if (sk.cd) f.cd[key] = sk.cd;
    apply(f, key, u);
  }
  function apply(f, key, u) {
    const sk = SKILLS[key];
    if (key === 'heal' || key === 'flash' || key === 'serenity') {
      heal(f, u, sk.amt * (u.hot > 0 && key !== 'serenity' ? 1.1 : 1), true);
      u.echo.push({ left: 4, rate: (sk.amt * 0.15) / 4 });
      if (key === 'serenity') emit(f, { type: 'sound', name: 'bell' });
    } else if (key === 'renew') {
      u.hot = 9; u.hotTick = 0; u.lastHeal = f.t; if (u.sulking) u.sulking = false;
      emit(f, { type: 'sound', name: 'renew' });
    } else if (key === 'poh' || key === 'sanctify') {
      const c = cellOf(f, u);
      for (const v of living(f)) if (hexDist(cellOf(f, v), c) <= 1) heal(f, v, sk.amt, true);
      if (key === 'sanctify') emit(f, { type: 'sound', name: 'bell' });
    } else if (key === 'purify') {
      const ds = u.debuffs.filter(d => DISPELLABLE[d.type]).sort((a, b) => (a.trap ? 1 : 0) - (b.trap ? 1 : 0) || (b.stack || 0) - (a.stack || 0));
      const d = ds[0];
      u.debuffs = u.debuffs.filter(x => x !== d);
      if (d.trap) f.stats.trapPops++; else f.stats.dispels++;
      emit(f, { type: 'sound', name: 'dispel' });
      emit(f, { type: 'dispel', id: u.id, trap: !!d.trap });
      onDebuffEnd(f, u, d, true);
    } else if (key === 'guardian') {
      u.guardian = 10;
      emit(f, { type: 'sound', name: 'renew' });
    }
    // 성언 게이지
    const before = { p: f.g.p, s: f.g.s };
    if (key === 'serenity') f.g.p = 0;
    if (key === 'sanctify') f.g.s = 0;
    if (sk.gp) f.g.p = Math.min(100, f.g.p + sk.gp);
    if (sk.gs) f.g.s = Math.min(100, f.g.s + sk.gs);
    if (before.p < 100 && f.g.p >= 100) emit(f, { type: 'gauge', which: '평온' });
    if (before.s < 100 && f.g.s >= 100) emit(f, { type: 'gauge', which: '신성화' });
  }

  function healerTick(f) {
    const dt = DT;
    const regen = 1.0 * f.gear.regen * f.enc.manaCoef * (f.symbol > 0 ? 4 : 1) * (f.medit > 0 ? 2.5 : 1);
    if (f.medit > 0) f.medit -= dt;
    if (f.potCd > 0) f.potCd = Math.max(0, f.potCd - dt);
    f.mana = Math.min(100, f.mana + regen * dt);
    if (f.symbol > 0) f.symbol -= dt;
    if (!f.symbolUsed && f.mana < 30) { f.symbolUsed = true; f.symbol = 5; emit(f, { type: 'msg', text: '상징: 5초간 마나 회복 4배' }); }
    for (const k in f.cd) f.cd[k] = Math.max(0, f.cd[k] - dt);
    if (f.gcd > 0) f.gcd -= dt;
    if (f.channel > 0) {
      f.channel -= dt; f.chTick += dt;
      if (f.chTick >= 1 - 1e-9) { f.chTick -= 1; for (const u of living(f)) heal(f, u, 120, true); }
    }
    if (f.cast) {
      f.cast.left -= dt;
      if (f.cast.left <= 1e-9) {
        const c = f.cast; f.cast = null;
        const sk = SKILLS[c.key];
        const u = f.party.find(x => x.id === c.uid);
        if (!u || !u.alive) emit(f, { type: 'msg', text: '대상이 쓰러져 시전 취소' });
        else if (f.mana < sk.cost) { f.stats.manaFails++; emit(f, { type: 'msg', text: '마나 부족' }); }
        else { f.mana -= sk.cost; apply(f, c.key, u); }
      }
    }
    if (f.queued && f.gcd <= 0 && !f.cast && f.channel <= 0) {
      const q = f.queued; f.queued = null;
      const sk = SKILLS[q.key];
      const tu = q.uid == null ? null : f.party.find(x => x.id === q.uid);
      if (q.uid != null && (!tu || !tu.alive)) { f.stats.queueLost++; emit(f, { type: 'msg', text: '대상이 쓰러져 예약한 힐 취소' }); }
      else {
        const idx = tu ? tu.cell : 0;
        const tg = canTarget(f, q.key, idx);
        if (tg.ok && !(sk.cd && f.cd[q.key] > 0) && f.mana >= sk.cost) exec(f, q.key, idx, tg.u);
        else { f.stats.queueLost++; if (!tg.ok && tg.reason) emit(f, { type: 'msg', text: tg.reason }); }
      }
    }
    f.stats.minMana = Math.min(f.stats.minMana, f.mana);
  }

  // ---------- 소비 아이템 사용 ----------
  function itemReady(f, key) {
    const it = ITEMS[key];
    if (!it || f.items[key] == null) return { ok: false, reason: '단축칸에 없는 아이템' };
    if (f.items[key] <= 0) return { ok: false, reason: `${it.name}: 이번 전투에서 다 씀` };
    if (it.kind === 'potion' && f.potCd > 0) return { ok: false, reason: `물약 재사용 대기 ${Math.ceil(f.potCd)}초` };
    return { ok: true };
  }
  function reviveTarget(f) {
    const dead = f.party.filter(u => !u.alive && !u.me);
    if (!dead.length) return null;
    const tanks = dead.filter(u => u.role === 'tank');
    const pool = tanks.length ? tanks : dead;
    return pool.reduce((a, b) => ((b.diedAt || 0) > (a.diedAt || 0) ? b : a));
  }
  function useItem(f, key, cellIdx) {
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
        const d = u.debuffs.find(x => !x.trap);
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
      const c = f.cells[cellIdx];
      const u = c && c.unit;
      if (!u) return { ok: false, reason: '빈 칸' };
      if (!u.alive) return { ok: false, reason: `${u.nick}은(는) 쓰러짐` };
      u.shield = 8;
      note = u.me ? '나' : u.nick;
    } else if (key === 'feather') {
      const u = reviveTarget(f);
      if (!u) return { ok: false, reason: '쓰러진 파티원 없음' };
      let c = f.cells[u.cell];
      if (c.unit) {
        const free = f.cells.filter(x => !x.unit && !dangerAt(f, x.i));
        const any = free.length ? free : f.cells.filter(x => !x.unit);
        if (!any.length) return { ok: false, reason: '되살릴 빈 칸 없음' };
        c = any.reduce((a, b) => (hexDist(b, f.cells[u.cell]) < hexDist(a, f.cells[u.cell]) ? b : a));
      }
      u.alive = true; u.max = u.base; u.hp = u.max * 0.3; u.cell = c.i; c.unit = u;
      u.debuffs = []; u.moving = null; u.react = null; u.fleeing = false; u.sulking = false; u.retryAt = f.t + 1;
      emit(f, { type: 'revive', id: u.id });
      emit(f, { type: 'sound', name: 'bell' });
      bark(f, u, '살았다…! 감사', true);
      note = u.nick;
    }
    f.items[key]--;
    if (it.kind === 'potion') f.potCd = POTION_CD;
    f.itemLog.push({ key, t: Math.round(f.t * 10) / 10 });
    emit(f, { type: 'item', key, note });
    return { ok: true };
  }

  // ---------- 한 틱 ----------
  function step(f) {
    if (f.over) return;
    f.t += DT; f.k++;
    healerTick(f);
    for (const u of f.party) unitTick(f, u);
    bossTick(f);
    if (!f.invuln) {
      const d = partyDps(f) * DT;
      f.bossHp -= d; f.dpsAcc += d;
    }
    if (f.k % 20 === 0 && f.dpsAcc > 0) { emit(f, { type: 'dps', amt: Math.round(f.dpsAcc) }); f.dpsAcc = 0; }
    const live = living(f);
    if (f.bossHp <= 0) { f.bossHp = 0; end(f, 'win', '보스를 쓰러뜨림'); }
    else if (!f.me.alive) end(f, 'lose', '힐러가 쓰러짐');
    else if (!live.some(u => u.role === 'tank')) end(f, 'lose', '탱커가 모두 쓰러짐');
    else if (live.length <= f.party.length * 0.3) end(f, 'lose', '파티원 70%가 쓰러짐');
  }
  function end(f, result, reason) {
    f.over = result; f.reason = reason;
    emit(f, { type: 'over', result });
  }

  // ---------- 자동 힐러 (시뮬레이션·데모용, sim decide() 이식) ----------
  function autoHealer(f) {
    if (f.cast || f.channel > 0 || f.gcd > 0 || f.queued) return;
    const live = living(f);
    if (!live.length) return;
    const pct = u => u.hp / u.max;
    const low = live.reduce((a, b) => (pct(b) < pct(a) ? b : a));
    const aoeSoon = f.tels.some(t => t.kind === 'aoe' && t.impact - f.t < 3.5);
    const cellIdx = u => (u.moving ? u.moving.from : u.cell);
    if (f.cd.hymn <= 0 && live.filter(u => pct(u) < 0.5).length >= Math.max(2, Math.floor(live.length / 2)) && f.mana >= 15) return use(f, 'hymn', 0);
    for (const t of f.tels) if (t.kind === 'buster' && f.cd.guardian <= 0 && f.mana >= 2) {
      const tk = f.party.find(u => u.id === t.units[0]);
      if (tk && tk.alive && pct(tk) < 0.75) return use(f, 'guardian', cellIdx(tk));
    }
    const thrifty = f.mana < 25; // 마나가 바닥나면 무료 성언을 아끼지 않는다
    if (f.g.p >= 100 && pct(low) < (thrifty ? 0.7 : 0.45)) return use(f, 'serenity', cellIdx(low));
    let best = null, score = 0;
    for (const c of live) {
      let s = 0; for (const v of live) if (hexDist(cellOf(f, v), cellOf(f, c)) <= 1) s += Math.min(180, v.max - v.hp);
      if (s > score) { best = c; score = s; }
    }
    if (f.g.s >= 100 && score > (thrifty ? 450 : 900)) return use(f, 'sanctify', cellIdx(best));
    if (pct(low) < 0.35 && f.mana > 8) return use(f, 'flash', cellIdx(low));
    if (score > 600 && f.mana > 12) return use(f, 'poh', cellIdx(best));
    if (f.cd.purify <= 0 && f.mana >= 4) {
      const c = live.filter(u => u.debuffs.some(d => DISPELLABLE[d.type] && !d.trap));
      if (c.length) return use(f, 'purify', cellIdx(c[0]));
    }
    const tanks = live.filter(u => u.role === 'tank' && u.hot <= 1);
    if (tanks.length && f.mana > 5) return use(f, 'renew', cellIdx(tanks[0]));
    if (aoeSoon && f.mana > 20) { const n = live.find(u => u.hot <= 0); if (n) return use(f, 'renew', cellIdx(n)); }
    if (pct(low) < 0.85 && f.mana > 3) return use(f, 'heal', cellIdx(low));
  }

  function simulate(cfg, maxT = 700) {
    const f = create(cfg);
    while (!f.over && f.t < maxT) { autoHealer(f); step(f); f.events.length = 0; }
    return f;
  }

  return { DT, DIFFS, GEARS, gearStats, PERS, CATS, ENCOUNTERS, SKILLS, BOARDS, create, step, use, slotKey, canTarget, queue, rollParty, ITEMS, POTION_CD, useItem, itemReady, reviveTarget, autoHealer, simulate, hexDist, living, partyDps, rngFrom };
})();
if (typeof module !== 'undefined') module.exports = Engine;
