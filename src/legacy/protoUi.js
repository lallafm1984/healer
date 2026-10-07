/* ===== 전투 화면 (프로토타입 v11 ui.js에서 옮김, 임시). 엔진은 engineShim이 넣는 TypeScript 엔진. 메뉴·정산은 새 화면(src/screens)이 맡고, 여기는 전투·휴식·일시정지만. 새 전투 화면(PixiJS)으로 바꾸면 지움 ===== */
(() => {
  const E = Engine;
  const $ = id => document.getElementById(id);
  const ROLE = {
    tank: { name: '탱커', color: '#8A97AD' },
    melee: { name: '근접', color: '#AE8A76' },
    ranged: { name: '원거리', color: '#7FA3A0' },
    healer: { name: '나', color: '#E9E1C6' },
  };
  const DEB = { '질병': '#D9A13B', '독': '#3CC24A', '마법': '#3D8BFF', '저주': '#A050E0' };
  const ICON_COLOR = { '숨결': '#D9A13B', '독침': '#3CC24A', '전염': '#D9A13B', '찍기': '#FF6B57', '증기': '#FF9F43', '파동': '#FF9F43', '장판': '#E0664F', '쥐떼': '#B9A38A', '폭풍': '#E0664F', '광폭': '#FF4A3D', '휘두': '#FF6B57', '쇳조': '#FF9F43' };
  // 8방향 스킬 배치 (2026-10-07 Lim): 칸에서 이 방향으로 쓸면 그 스킬. 기본은 위 = 정화(02 4-1), 로비 「스킬 배치」에서 바꿀 수 있음
  const GRID = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE'];
  const ARROW = { NW: '↖', N: '↑', NE: '↗', W: '←', E: '→', SW: '↙', S: '↓', SE: '↘' };
  const READ_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const LAYOUT_SKILLS = ['heal', 'flash', 'renew', 'poh', 'purify', 'guardian', 'hymn'];
  const DEFAULT_LAYOUT = { NW: null, N: 'purify', NE: 'heal', W: 'renew', E: 'flash', SW: 'hymn', S: 'poh', SE: 'guardian' };

  function validLayout(v) {
    if (!v || typeof v !== 'object') return false;
    const keys = READ_ORDER.map(d => v[d] || null);
    return LAYOUT_SKILLS.every(k => keys.filter(x => x === k).length === 1) && keys.every(k => k === null || LAYOUT_SKILLS.includes(k));
  }
  const layoutLabel = k => k === 'heal' ? '치유/평온' : k === 'poh' ? '기원/신성화' : E.SKILLS[k].name;
  const layoutText = l => READ_ORDER.filter(d => l[d]).map(d => `${ARROW[d]} ${layoutLabel(l[d])}`).join(' · ');
  const layoutCode = l => READ_ORDER.map(d => `${d}:${l[d] || '-'}`).join(',');
  let DIRS = [];
  function applyLayout() { DIRS = GRID.map(d => d ? { d, arrow: ARROW[d], key: S.layout[d] || null } : null); }
  const SECTOR = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  const SWIPE_MIN = 26;
  function swipeDir(dx, dy) {
    if (Math.hypot(dx, dy) < SWIPE_MIN) return null;
    const a = Math.atan2(-dy, dx) * 180 / Math.PI;
    return SECTOR[((Math.round(a / 45) % 8) + 8) % 8];
  }
  const dirSlot = d => DIRS.find(x => x && x.d === d) || null;
  const DIFF_NOTE = {
    '쉬움': '받는 피해 ×0.8 · 파티원 회피 95%',
    '보통': '받는 피해 ×1.0 · 파티원 회피 85%',
    '어려움': '받는 피해 ×1.2 · 파티원 회피 75% · 권장 장비 고급',
    '악몽': '받는 피해 ×1.4 · 파티원 회피 65% · 파티원 체력·딜 ×1.15 · 권장 장비 희귀 +5',
  };
  const TAP_KEYS = { heal: '치유 (1.8초 시전)', flash: '순간 치유 (1초 시전)', renew: '소생 (즉시, 지속 힐)' };
  const SEL = '#FFFFFF'; // 시전 대상·장전 표시 (황토색 질병과 구분)
  const DEFAULT_GEAR = { '쉬움': 'none', '보통': 'none', '어려움': 'adv0', '악몽': 'rare5' };
  const GEAR_RANK = { none: 0, adv0: 1, rare5: 2, epic5: 3 };

  // 설정·편성은 새 화면이 start()/settings()로 넣어 줌
  const S = { diff: '보통', gearStats: null, level: 100, party: null, items: [], sound: true, vibe: true, auto: false, tapKey: 'heal', hand: 'right', zoom: true, layout: Object.assign({}, DEFAULT_LAYOUT), run: null, onEnd: null, slots: 4, coach: null, onSetting: null };
  applyLayout();
  let F = null, armed = null, paused = false, overShown = false;
  const ui = { floats: [], bubbles: [], pointer: null, lastHealSnd: 0, tickSec: null, runRef: null, ratings: {}, touchSeen: false, lowFlags: {}, lastLowVibe: 0, layout: null, qAt: 0,
    hitFx: {}, disp: {}, lastRender: 0, lens: null, vibeAt: 0, vibedTel: new Set(), lastHeart: 0, debSnd: {}, tapOff: [], lastTap: null, retarget: 0 };
  function seed() { return (Math.random() * 1e9) | 0; }
  // ---------- 소비 아이템 (19 2부) ----------
  // 단축칸 2×2. 레벨에 따라 열린 칸 수가 다름 (18 2-2: Lv 1 = 2칸, 20 = 3칸, 40 = 4칸). 구성은 새 화면(편성)에서 고름
  const ITEM_SLOTS = 4;
  const SLOT_LV = [1, 1, 20, 40];
  const potion = (c) => `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.5 6h7v4.2a9 9 0 1 1-7 0z" fill="${c}" stroke="#0B0B12" stroke-width="2" stroke-linejoin="round"/><rect x="11.5" y="3" width="9" height="4" rx="1.2" fill="#C9923F" stroke="#0B0B12" stroke-width="1.6"/><ellipse cx="12.8" cy="20" rx="1.8" ry="3" fill="rgba(255,255,255,.5)"/></svg>`;
  const scroll = (mark) => `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="7" width="18" height="18" rx="2" fill="#E9DDBC" stroke="#0B0B12" stroke-width="2"/><rect x="5" y="4" width="22" height="5" rx="2.5" fill="#B98F4E" stroke="#0B0B12" stroke-width="1.8"/><rect x="5" y="23" width="22" height="5" rx="2.5" fill="#B98F4E" stroke="#0B0B12" stroke-width="1.8"/>${mark}</svg>`;
  const ITEM_ICON = {
    mana: potion('#4C8FE0'),
    medit: potion('#51C6C0'),
    life: potion('#D9342B'),
    cleanse: scroll('<path d="M16 11.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#2E9A94" stroke="#0B0B12" stroke-width="1"/>'),
    shield: scroll('<path d="M16 11l5 1.8v3.4c0 3-2.2 4.8-5 5.8-2.8-1-5-2.8-5-5.8v-3.4z" fill="#F0C46A" stroke="#0B0B12" stroke-width="1.4"/>'),
    feather: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M25 4C15 6 9 13 8.5 24l2.2 1.6c3-1.2 5.2-3.8 6.3-7l3.8-.8-2.9-1.2 4.6-3.9-3.8.2C21.6 10.3 23.8 7.4 25 4z" fill="#F6F0E0" stroke="#0B0B12" stroke-width="1.8" stroke-linejoin="round"/><path d="M21 9L6 28" stroke="#C9923F" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  };
  // 보스 궁합 힌트 (19 9장 등록)
  const ITEM_HINT = {
    warden: '💡 녹슨 문지기는 탱커 강타가 세요. 보호 두루마리를 강타 직전 탱커에게 걸면 버티기 쉬워요.',
    plague: '💡 역병 군주는 독침을 걸어요. 사제는 독을 못 지우지만 해제 두루마리는 지울 수 있어요.',
  };


  // ---------- 소리 (아트·사운드 가이드 16, 7장) ----------
  const Snd = {
    ctx: null,
    init() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { this.ctx = null; } },
    tone(freq, dur, type, vol, slide, delay) {
      if (!S.sound || !this.ctx) return;
      const t = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + 0.03);
    },
    play(n) {
      switch (n) {
        case 'heal': this.tone([784, 880, 988, 1047][(Math.random() * 4) | 0], 0.14, 'sine', 0.05); break;
        case 'crit': this.tone(1047, 0.22, 'sine', 0.05); this.tone(1319, 0.22, 'sine', 0.04, 0, 0.03); break;
        case 'renew': this.tone(660, 0.18, 'triangle', 0.04, 990); break;
        case 'dispel': this.tone(1568, 0.12, 'triangle', 0.05); this.tone(2093, 0.1, 'sine', 0.03, 0, 0.05); break;
        case 'bell': [1320, 2640, 1980].forEach((f, i) => this.tone(f, 1.2, 'sine', 0.05 / (i + 1))); break;
        case 'buster': this.tone(110, 0.35, 'sine', 0.14, 70); break;
        case 'aoe': this.tone(300, 0.6, 'sawtooth', 0.03, 900); break;
        case 'tick': this.tone(620, 0.05, 'square', 0.03); break;
        case 'death': this.tone(400, 0.45, 'triangle', 0.06, 140); break;
        case 'burst': this.tone(200, 0.25, 'sawtooth', 0.05, 80); break;
        case 'hymn': [523, 659, 784].forEach((f, i) => this.tone(f, 1.5, 'sine', 0.035, 0, i * 0.08)); break;
        case 'gauge': [1320, 1760].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.04, 0, i * 0.12)); break;
        case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.06, 0, i * 0.12)); break;
        case 'lose': [392, 330, 262].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.06, 0, i * 0.18)); break;
        case 'error': this.tone(180, 0.12, 'square', 0.03); break;
        case 'cast': this.tone(523, 0.08, 'sine', 0.025, 659); break;
        case 'zone': this.tone(70, 0.6, 'sine', 0.12, 55); this.tone(140, 0.4, 'triangle', 0.03, 90); break;
        case 'heart': this.tone(62, 0.12, 'sine', 0.13); this.tone(58, 0.14, 'sine', 0.1, 0, 0.18); break;
        case 'cough': this.tone(240, 0.07, 'sawtooth', 0.03, 150); this.tone(220, 0.07, 'sawtooth', 0.025, 140, 0.1); break;
        case 'bubble': [700, 900, 1150].forEach((f, i) => this.tone(f, 0.05, 'sine', 0.025, f * 1.4, i * 0.06)); break;
        case 'zap': this.tone(1800, 0.06, 'square', 0.02, 400); break;
        case 'potion': [420, 560, 760].forEach((f, i) => this.tone(f, 0.09, 'sine', 0.05, f * 1.3, i * 0.07)); break;
        case 'scroll': this.tone(900, 0.18, 'triangle', 0.03, 1800); this.tone(1568, 0.4, 'sine', 0.035, 0, 0.12); break;
      }
    },
  };
  function vibe(ms, important) {
    if (!S.vibe) return;
    const now = performance.now();
    if (!important && now - ui.vibeAt < 1000) return;
    ui.vibeAt = now;
    try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* 지원 안 함 (iOS 사파리) */ }
  }


  // ---------- 보스 그림 (임시) ----------
  function bossSvg(script) {
    if (script === 'warden' || script === 'scrap' || script === 'trash') return `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="#0E0E15" stroke-width="4" stroke-linejoin="round"><rect x="6" y="46" width="16" height="34" rx="6" fill="#7E4426"/><rect x="78" y="46" width="16" height="34" rx="6" fill="#7E4426"/><rect x="14" y="40" width="72" height="52" rx="10" fill="#9C5A33"/><rect x="28" y="10" width="44" height="34" rx="8" fill="#B5683A"/><path d="M40 60h20v16H40z" fill="#6E3A20" stroke-width="3"/></g><rect x="35" y="22" width="11" height="7" rx="2" fill="#FFB347"/><rect x="54" y="22" width="11" height="7" rx="2" fill="#FFB347"/><g fill="#5E321C"><circle cx="25" cy="52" r="3"/><circle cx="75" cy="52" r="3"/><circle cx="25" cy="82" r="3"/><circle cx="75" cy="82" r="3"/></g></svg>`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M84 22V94" stroke="#0E0E15" stroke-width="9"/><path d="M84 22V94" stroke="#5B3B22" stroke-width="4"/><g stroke="#0E0E15" stroke-width="4" stroke-linejoin="round"><path d="M50 8C28 10 22 34 22 52L14 94H80L76 52C76 34 72 10 50 8Z" fill="#6E7233"/><path d="M50 20C38 22 34 34 34 48C40 56 60 56 66 48C66 34 62 22 50 20Z" fill="#1C1B14"/></g><circle cx="84" cy="18" r="7" fill="#C8E06A" stroke="#0E0E15" stroke-width="3"/><circle cx="43" cy="40" r="3.5" fill="#C8E06A"/><circle cx="57" cy="40" r="3.5" fill="#C8E06A"/><path d="M30 72Q50 65 70 72" stroke="#4E5124" stroke-width="4" fill="none"/></svg>`;
  }

  // ---------- 보스 공략 (전투 전 화면 · 일시정지 · 전투 중 기술 팝업이 모두 이 한 곳의 데이터를 씀) ----------
  // 숫자는 엔진에서 읽는다: 기술 이름·아이콘·첫 시각·주기·예고·탱커 피해·장판 초당 피해/지속은 시험 전투(E.create)의 skills에서,
  // 피해 배율·회피는 E.DIFFS에서, 보스·파티 체력(악몽 배율 포함)은 시험 전투에서.
  // 기술 함수 안쪽 숫자처럼 엔진 밖으로 안 나오는 값만 GB에 옮겨 적음 → engine.js SCRIPTS를 바꾸면 여기도 같이 (guide.js가 엔진과 대조함)
  const GB = {
    warden: { auto: 70, aoe: 220, zoneAt: 0.4, enrName: '증기 폭주', enrDmg: 220, enrPeriod: 2, enrCast: 1 },
    scrap: { auto: 75, aoe: 170, enrName: '고철 폭주', enrDmg: 150, enrPeriod: 2, enrCast: 1 },
    trash: {},
    plague: {
      auto: 60, breathPct: 5, breathMax: 4, breathDur: 60, stingDot: 15, stingDur: 12, pulse1: 150, pulse2: 180, pulse2Period: 25, pulse2Delay: 22,
      interAt: 0.6, interDur: 25, rats: 30, contDelay: 10, contDur: 8, spread: 150, p3At: 0.3,
      targets: { breath: [2, 4], cont: [1, 2], rats: [3, 6] }, // [10인, 20인] — 엔진은 20인(big)에서 대상 수만 늘림
      enrName: '역병 폭주', enrDmg: 180, enrPeriod: 3, enrCast: 1,
    },
  };
  const probeCache = {};
  function probe(encKey, diff) {
    const k = encKey + '|' + diff;
    if (!probeCache[k]) {
      const f = E.create({ encounter: encKey, diff, seed: 1 });
      const sk = {};
      for (const s of f.skills) sk[s.key] = { name: s.name, icon: s.icon, next: s.next, period: s.period, cast: s.cast, dmg: s.dmg, dps: s.dps, dur: s.dur };
      // 2인·3인 판엔 근접이 없을 수 있어서 딜러 아무나
      const hp = r => Math.round((f.party.find(u => u.role === r) || f.party.find(u => u.role !== 'tank' && !u.me) || { max: 600 }).max);
      probeCache[k] = { sk, m: f.dmgMult, bossMax: f.bossMax, hp: { tank: hp('tank'), dps: hp('melee'), me: hp('healer') } };
    }
    return probeCache[k];
  }
  const secT = x => `${+x.toFixed(1)}초`;
  // 받침 있으면 a(이), 없으면 b(가)
  const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c < 11172 && c % 28 ? a : b; };
  const iga = w => w + josa(w, '이', '가');
  // 대응 문구에 지금 스킬 배치의 쓸기 방향을 붙임 (로비에서 바꿀 수 있어서)
  function act(key) { const d = READ_ORDER.find(x => S.layout[x] === key); return d ? `${E.SKILLS[key].name}(${ARROW[d]} 쓸기)` : E.SKILLS[key].name; }
  const ENRAGE_HOW = '버티는 기술이 아니에요. 그 전에 잡으려면 딜러가 쓰러지지 않게';

  const GUIDE = {
    // 고철 경비병 (23 3장)
    scrap(c) {
      const { sk, B, n, hp } = c;
      const bu = sk.buster, ao = sk.aoe;
      const N = { buster: n(bu.dmg), aoe: n(B.aoe), autoLo: n(B.auto * 0.7), autoHi: n(B.auto * 1.3), enr: n(B.enrDmg) };
      const pct = (a, b) => Math.round((a / b) * 100);
      return {
        nums: N,
        cur: F => (F.enraged ? 'enrage' : 'p1'),
        phases: [
          { id: 'p1', name: '시작', at: '처음부터', text: `${bu.name} · ${ao.name} 반복` },
          { id: 'enrage', name: '광폭화', at: mmss(c.enc.enrage), text: `${iga(B.enrName)} ${B.enrPeriod}초마다`, enr: true },
        ],
        skills: [
          { ic: bu.icon, name: bu.name,
            what: `탱커에게 <b>${N.buster}</b> 피해 (탱커 체력 ${hp.tank}의 ${pct(N.buster, hp.tank)}%)`,
            every: `${secT(bu.period)}마다`, tip: () => [`탱커에게 ${N.buster} 피해`] },
          { ic: ao.icon, name: ao.name,
            what: `파티 전원에게 <b>${N.aoe}</b> 피해`,
            every: `${secT(ao.period)}마다`, tip: () => [`전원에게 ${N.aoe} 피해`] },
          { ic: '광폭', name: B.enrName, enr: true,
            what: `파티 전원에게 <b>${N.enr}</b> 피해`,
            every: `${mmss(c.enc.enrage)}부터`, tip: () => [`${B.enrPeriod}초마다 전원 ${N.enr}`] },
        ],
      };
    },
    // 잡몹 구간 (23 2장): 잡는 순서 = 진행, 잡몹 공격 = 기술
    trash(c) {
      const { enc, n } = c;
      const mobs = enc.mobs;
      const skills = [];
      for (const m of mobs) for (const a of m.attacks) {
        const who = a.to === 'tank' ? '탱커' : a.to === 'other' ? '탱커 아닌 1명' : '파티 전원';
        const amt = a.jitter ? `${n(a.dmg * (1 - a.jitter))}~${n(a.dmg * (1 + a.jitter))}` : n(a.dmg);
        const each = m.count > 1 ? ' (한 마리당)' : '';
        skills.push({ ic: a.icon || m.name.slice(0, 2), name: a.name || `${m.name} 공격`,
          what: `${who}에게 <b>${amt}</b> 피해${each}${a.cast ? ` · 예고 ${secT(a.cast)}` : ''}. ${m.name}${josa(m.name, '이', '가')} 쓰러지면 멈춰요`,
          every: `${secT(a.period)}마다`, tip: () => [`${who}에게 ${amt}${each}`] });
      }
      return {
        nums: {},
        cur: F => { const m = F.mobs.find(x => x.alive); return m ? 'm' + mobs.findIndex(d => d.name === m.name) : ''; },
        phases: mobs.map((m, i) => ({ id: 'm' + i, name: `${m.name}${m.count > 1 ? ` ×${m.count}` : ''}`, at: `${i + 1}번째로 잡아요`, text: `체력 ${Math.round(m.hp * c.hpMult).toLocaleString('ko-KR')}${m.count > 1 ? '씩' : ''}` })),
        skills,
      };
    },
    warden(c) {
      const { sk, B, n, hp } = c;
      const bu = sk.buster, ao = sk.aoe, zo = sk.zone;
      const N = { buster: n(bu.dmg), aoe: n(B.aoe), autoLo: n(B.auto * 0.7), autoHi: n(B.auto * 1.3), zoneDps: n(zo.dps), zoneTot: n(zo.dps * zo.dur), enr: n(B.enrDmg) };
      const pct = (a, b) => Math.round((a / b) * 100);
      return {
        nums: N,
        cur: F => (F.enraged ? 'enrage' : F.bossHp <= F.bossMax * B.zoneAt ? 'p40' : 'p1'),
        phases: [
          { id: 'p1', name: '시작', at: `체력 100~${B.zoneAt * 100}%`, text: `${bu.name} · ${ao.name} 반복` },
          { id: 'p40', name: '녹이 흘러내림', at: `체력 ${B.zoneAt * 100}% 아래`, text: `${iga(zo.name)} 더해져요` },
          { id: 'enrage', name: '광폭화', at: mmss(c.enc.enrage), text: `${iga(B.enrName)} ${B.enrPeriod}초마다`, enr: true },
        ],
        skills: [
          { ic: bu.icon, name: bu.name,
            when: `${secT(bu.next + bu.cast)}에 첫 타, 그 뒤 ${secT(bu.period)}마다 · 예고 ${secT(bu.cast)}`,
            what: `탱커에게 <b>${N.buster}</b> 피해 (탱커 체력 ${hp.tank}의 ${pct(N.buster, hp.tank)}%)`,
            how: `예고가 뜨면 탱커를 미리 가득 채우기. 못 채우면 ${act('guardian')}을 걸어 한 번 버티기`,
            every: `${secT(bu.period)}마다`, tip: () => [`탱커에게 ${N.buster} 피해`] },
          { ic: ao.icon, name: ao.name,
            when: `${secT(ao.next + ao.cast)}에 첫 타, 그 뒤 ${secT(ao.period)}마다 · 예고 ${secT(ao.cast)}`,
            what: `파티 전원에게 <b>${N.aoe}</b> 피해 (파티원 체력 ${hp.dps}의 ${pct(N.aoe, hp.dps)}%)`,
            how: `예고 동안 여러 명에게 ${act('renew')}을 걸고, 맞은 뒤 ${act('poh')}으로 모인 칸을 채우기`,
            every: `${secT(ao.period)}마다`, tip: () => [`전원에게 ${N.aoe} 피해`] },
          { ic: zo.icon, name: zo.name,
            when: `보스 체력 ${B.zoneAt * 100}% 아래부터 · ${secT(zo.period)}마다 · 예고 ${secT(zo.cast)}`,
            what: `파티원 1명 자리와 옆 칸에 ${secT(zo.dur)} 장판. 안에 있으면 초당 <b>${N.zoneDps}</b> (다 맞으면 ${N.zoneTot})`,
            how: '파티원이 알아서 피해요. 고집불통·허세꾼은 잘 안 피하니 그 사람을 채우기',
            every: `체력 ${B.zoneAt * 100}%부터 ${secT(zo.period)}마다`, tip: () => [`1명 주변 장판, 초당 ${N.zoneDps}`] },
          { ic: '광폭', name: B.enrName, enr: true,
            when: `광폭화 ${mmss(c.enc.enrage)}부터 ${B.enrPeriod}초마다 · 예고 ${secT(B.enrCast)}`,
            what: `파티 전원에게 <b>${N.enr}</b> 피해. 몇 번이면 전멸`,
            how: ENRAGE_HOW,
            every: `${mmss(c.enc.enrage)}부터`, tip: () => [`${B.enrPeriod}초마다 전원 ${N.enr}`] },
        ],
      };
    },
    plague(c) {
      const { sk, B, n, hp, big } = c;
      const br = sk.breath, st = sk.sting, pu = sk.aoe, co = sk.contagion, so = sk.storm;
      const T = { breath: B.targets.breath[big ? 1 : 0], cont: B.targets.cont[big ? 1 : 0], rats: B.targets.rats[big ? 1 : 0] };
      const N = {
        autoLo: n(B.auto * 0.7), autoHi: n(B.auto * 1.3), sting: n(B.stingDot), stingTot: n(B.stingDot * B.stingDur), pulse1: n(B.pulse1), pulse2: n(B.pulse2),
        rats: n(B.rats), ratsTot: n(B.rats * B.interDur), spread: n(B.spread), stormDps: n(so.dps), stormTot: n(so.dps * so.dur), enr: n(B.enrDmg),
        breathTargets: T.breath, stingTargets: T.breath, contTargets: T.cont, ratTargets: T.rats,
      };
      const phases = [
        { id: 'p1', name: '1페이즈', at: `체력 100~${B.interAt * 100}%`, text: `${br.name} · ${st.name} · ${pu.name}` },
        { id: 'inter', name: '인터미션', at: `체력 ${B.interAt * 100}%, ${B.interDur}초`, text: `보스 무적, 예고 기술 멈춤. 쥐떼가 뒷줄 ${T.rats}명을 물어요` },
        { id: 'p2', name: '2페이즈', at: '인터미션 뒤', text: `${st.name} 끝 · ${co.name} 시작 · 파동이 ${N.pulse2}로 세지고 ${B.pulse2Period}초마다` },
      ];
      if (big) phases.push({ id: 'p3', name: '3페이즈', at: `체력 ${B.p3At * 100}% 아래`, text: `${iga(so.name)} 더해져요` });
      phases.push({ id: 'enrage', name: '광폭화', at: mmss(c.enc.enrage), text: `${iga(B.enrName)} ${B.enrPeriod}초마다`, enr: true });
      const skills = [
        { ic: br.icon, name: br.name,
          when: `${secT(br.next)}에 첫 번째, ${secT(br.period)}마다 · 예고 없음 · 인터미션엔 멈춤`,
          what: `무작위 ${T.breath}명에게 질병: 겹칠 때마다 최대 체력 -${B.breathPct}% (최대 ${B.breathMax}번, -${B.breathPct * B.breathMax}%) · ${B.breathDur}초`,
          how: `${act('purify')}로 지우기. 많이 겹친 사람부터. 체력 ${B.interAt * 100}% 직전엔 다 지워 두기: 디버프가 남은 사람은 인터미션 때 독침이 더 걸려요`,
          every: `${secT(br.period)}마다`, tip: () => [`${T.breath}명 질병, 최대 체력 -${B.breathPct}%씩 겹침`] },
        { ic: st.icon, name: st.name,
          when: `1페이즈만 · ${secT(st.next)}에 첫 번째, ${secT(st.period)}마다 · 예고 없음`,
          what: `무작위 ${T.breath}명에게 독: ${B.stingDur}초 동안 초당 <b>${N.sting}</b> (모두 ${N.stingTot})`,
          how: '사제는 독을 못 지워요. 소생을 걸고 치유로 버티기',
          every: `1페이즈 · ${secT(st.period)}마다`, tip: () => [`${T.breath}명 독, ${B.stingDur}초간 초당 ${N.sting}`] },
        { ic: pu.icon, name: pu.name,
          when: `${secT(pu.next + pu.cast)}에 첫 타, ${secT(pu.period)}마다 · 2페이즈는 시작 ${secT(B.pulse2Delay + pu.cast)} 뒤부터 ${secT(B.pulse2Period)}마다 · 예고 ${secT(pu.cast)}`,
          what: `파티 전원에게 <b>${N.pulse1}</b> 피해 · 2페이즈부터 <b>${N.pulse2}</b>`,
          how: `예고 동안 ${act('renew')}을 깔고, 맞은 뒤 ${act('poh')}. 여러 명이 절반 아래면 ${act('hymn')}`,
          every: `${secT(pu.period)}마다 · 2페이즈 ${secT(B.pulse2Period)}마다`, tip: F => [`전원에게 ${F && F.phase >= 2 ? N.pulse2 : `${N.pulse1} (2페이즈 ${N.pulse2})`} 피해`] },
        { ic: '쥐떼', name: '쥐떼 (인터미션)',
          when: `보스 체력 ${B.interAt * 100}%에서 ${B.interDur}초 동안 · 보스 무적`,
          what: `맨 뒷줄 원거리 ${T.rats}명이 초당 <b>${N.rats}</b> 피해 (${B.interDur}초면 ${N.ratsTot}). 시작할 때 디버프가 있는 사람은 독침이 하나 더`,
          how: '‘쥐떼’ 표시가 붙은 사람에게 소생을 걸고 치유를 몰아주기',
          every: `체력 ${B.interAt * 100}%에서 ${B.interDur}초`, tip: () => [`뒷줄 ${T.rats}명 초당 ${N.rats}, 보스 무적`] },
        { ic: co.icon, name: co.name,
          when: `2페이즈부터 · 인터미션 끝 ${secT(B.contDelay)} 뒤 첫 번째, ${secT(co.period)}마다`,
          what: `무작위 ${T.cont}명에게 함정 질병 (점선 테두리) ${secT(B.contDur)}. 끝나면 터져 옆 칸 사람에게 <b>${N.spread}</b> 피해 + 독침. 정화하면 그 자리에서 바로 터져요${big ? '. 두 대상이 붙어 있으면 걸리자마자 터져요' : ''}`,
          how: '정화하지 말고 기다리기. 터지기 전에 옆 칸 사람 체력을 채워 두기',
          every: `2페이즈 · ${secT(co.period)}마다`, tip: () => [`${secT(B.contDur)} 뒤 터져 옆 칸 ${N.spread} + 독침. 정화하면 바로 터짐`] },
      ];
      if (big) skills.push({ ic: so.icon, name: so.name,
        when: `3페이즈(체력 ${B.p3At * 100}% 아래)부터 ${secT(so.period)}마다 · 예고 ${secT(so.cast)}`,
        what: `판 바깥 1/3 (왼쪽·오른쪽 번갈아)에 ${secT(so.dur)} 장판. 안에 있으면 초당 <b>${N.stormDps}</b> (다 맞으면 ${N.stormTot})`,
        how: '파티원(나 포함)이 알아서 옮겨요. 칸이 모자라 남는 사람이 생기니 장판 안 사람부터 치유',
        every: `3페이즈 · ${secT(so.period)}마다`, tip: () => [`판 바깥 1/3 장판, 초당 ${N.stormDps}`] });
      skills.push({ ic: '광폭', name: B.enrName, enr: true,
        when: `광폭화 ${mmss(c.enc.enrage)}부터 ${B.enrPeriod}초마다 · 예고 ${secT(B.enrCast)}`,
        what: `파티 전원에게 <b>${N.enr}</b> 피해. 몇 번이면 전멸`,
        how: ENRAGE_HOW,
        every: `${mmss(c.enc.enrage)}부터`, tip: () => [`${B.enrPeriod}초마다 전원 ${N.enr}`] });
      return {
        nums: N,
        cur: F => (F.enraged ? 'enrage' : F.phase === 0 ? 'inter' : F.phase === 3 ? 'p3' : F.phase === 2 ? 'p2' : 'p1'),
        phases, skills,
      };
    },
  };
  function guideModel(encKey, diff) {
    const enc = E.ENCOUNTERS[encKey], P = probe(encKey, diff);
    const m = P.m, n = x => Math.round(x * m);
    const g = GUIDE[enc.script]({ enc, diff, m, n, big: !!enc.big, sk: P.sk, hp: P.hp, B: GB[enc.script], hpMult: P.bossMax / enc.hp });
    return Object.assign({ enc, diff, m, dodge: E.DIFFS[diff].dodge, bossMax: P.bossMax, hp: P.hp, tier: enc.tier.replace(' · ', ' '), B: GB[enc.script] }, g);
  }
  // 지금 돌고 있는 기술인지 (일시정지에서 '지금' 표시): 엔진 기술 상태 그대로 읽음
  function skillLive(F, ic) {
    if (ic === '쥐떼') return F.phase === 0 && F.phaseName === '인터미션';
    return F.skills.some(s => s.icon === ic && !s.hidden && s.next !== Infinity && s.active(F));
  }
  function guideHtml(g, F) {
    const cur = F ? g.cur(F) : null;
    const now = '<em class="now">지금</em>';
    const head = `<div class="gd-top"><div class="gd-art">${bossSvg(g.enc.script)}</div><div class="gd-id">
      <b class="gd-name">${g.enc.name}</b>
      <div class="gd-tags"><span class="tag">${g.tier}</span><span class="tag diff">${g.diff}</span>${isFinite(g.enc.enrage) ? `<span class="tag enr">광폭화 ${mmss(g.enc.enrage)}</span>` : ''}</div></div></div>`;
    const phases = `<h4 class="gd-h">진행</h4><ol class="gd-phases">${g.phases.map((p, i) => `<li class="${p.id === cur ? 'cur' : ''}${p.enr ? ' enr' : ''}"><i>${i + 1}</i><div><b>${p.name}</b><small>${p.at}</small><p>${p.text}</p></div>${p.id === cur ? now : ''}</li>`).join('')}</ol>`;
    const skills = `<h4 class="gd-h">보스 기술 <small>전투 중 위쪽 예고 칸을 누르면 짧은 설명</small></h4><div class="gd-skills">${g.skills.map(s => {
      const live = F && skillLive(F, s.ic);
      return `<article class="gs${s.enr ? ' enr' : ''}${live ? ' live' : ''}" data-ic="${s.ic}"><header><span class="ic" style="background:${ICON_COLOR[s.ic] || '#BBB'}">${s.ic}</span><b>${s.name}</b>${live ? now : ''}</header>
        <p class="gs-line">${s.tip(F)[0]}<small>${s.every}</small></p></article>`;
    }).join('')}</div>`;
    return `<div class="gd">${head}${phases}${skills}</div>`;
  }

  // ---------- 한 판 = 전투 1개 이상. 던전은 구간을 이어서 하고 사이에 휴식 (23) ----------
  const curKey = () => S.run.segs[S.run.idx];
  // 처음부터 다시 (같은 파티, 같은 콘텐츠)
  function resetRun() {
    Object.assign(S.run, { idx: 0, carry: null, time: 0, deaths: 0, restSec: 0, healed: 0, overheal: 0, dispels: 0, dispellable: 0, itemLog: [], auto: S.auto });
  }

  // 새 화면(.screen)이 늘어나도 하나만 보이게
  function show(id) { document.querySelectorAll('#app > .screen').forEach(s => { s.hidden = s.id !== id; }); }

  // ---------- 전투 시작 ----------
  // guideSec: 이번 판 직전에 공략 화면을 본 시간 (다시 도전·처음부터 다시는 공략 없이 바로 시작 → 0)
  function startBattle(guideSec) {
    // 던전: 같은 파티로 구간을 이어 감. 마나·성언 게이지는 앞 구간(+휴식)에서 이어받고, 아이템 횟수·재사용 대기는 구간마다 새로 (23 4장)
    // 첫 판은 편성 화면 미리보기와 같은 시드 (시작 위치가 같게). 처음부터 다시·다음 구간은 새 시드
    const sd = S.run.seed0 != null ? S.run.seed0 : seed(); S.run.seed0 = null;
    F = E.create({ encounter: curKey(), diff: S.diff, gearStats: S.gearStats || undefined, seed: sd, party: S.party, items: S.items, carry: S.run.carry || undefined, level: S.level });
    ui.itemArmed = null; ui.itemPress = null; buildItems();
    // 전투 시작 카운트다운 3초 (19 4장 6번). 자동 힐러 구경은 바로 시작
    ui.pullLeft = S.auto ? 0 : 3; ui.pullShown = null;
    $('pull').hidden = !(ui.pullLeft > 0);
    armed = null; paused = false; overShown = false;
    ui.guideSec = guideSec || 0; ui.skillTips = 0; closeTip();
    ui.floats = []; ui.bubbles = []; ui.runRef = null; ui.ratings = {}; ui.lowFlags = {}; ui.tickSec = null;
    ui.hitFx = {}; ui.disp = {}; ui.busterHint = false; ui.swipes = {}; ui.swipeCancel = 0; ui.swipeEmpty = 0; ui.lens = null; ui.vibedTel = new Set(); ui.debSnd = {}; ui.tapOff = []; ui.lastTap = null; ui.retarget = 0;
    $('controls').classList.toggle('wheel-left', S.hand === 'left');
    $('pause').hidden = true; $('preview').hidden = true; $('toast').innerHTML = '';
    clearCoach();
    const enc = F.enc;
    $('bossArt').innerHTML = bossSvg(enc.script);
    $('bossName').textContent = bossTitle();
    $('battle').classList.toggle('compact', !!enc.big);
    show('battle');
    layoutBattle();
    if (S.auto) toast('자동 힐러가 플레이해요 (기록 안 남김)');
    else if (S.run.idx === 0) toast(`칸을 탭하면 ${E.SKILLS[tapKey()].name}`);
    $('gauges').classList.toggle('locked', !E.knowsPassive(F, 'words'));
    $('controls').classList.toggle('nowords', !E.knowsPassive(F, 'words'));
  }
  // ---------- 튜토리얼 안내 (02 11장, 09 4장): 전투를 잠깐 멈추고 할 일 하나를 짚어 줌 ----------
  // when = 띄울 때, at = 짚을 칸(파티원), slot = 짚을 휠 스킬, need = 끝내는 스킬 (없으면 「확인」), freeze = false면 멈추지 않고 4초 뒤 사라짐
  const tankOf = f => f.party.find(u => u.role === 'tank' && u.alive);
  const lowest = f => f.party.filter(u => u.alive).reduce((a, b) => (b.hp / b.max < a.hp / a.max ? b : a));
  const firstTel = (f, kind) => f.tels.find(t => t.kind === kind && f.t - t.start < 0.5);
  const COACH = {
    duo: [
      { when: f => { const u = tankOf(f); return f.t >= 6 || (u && u.hp / u.max < 0.92); }, text: '탱커가 맞고 있어요. <b>탱커 칸을 탭</b>하면 치유해요.', at: tankOf, need: 'heal' },
      { when: f => f.stats.casts.heal >= 1 && f.t >= 5, freeze: false, text: '잘했어요! 아래 막대가 차면 힐이 들어가요. 체력이 줄 때마다 다시 탭해요.' },
    ],
    explore: [
      { when: f => f.t >= 1 && E.knows(f, 'renew'), text: '새로 배운 <b>소생</b>: 휠에서 소생을 누른 뒤 탱커 칸을 탭해요. 9초 동안 저절로 차요.', at: tankOf, slot: 'renew', need: 'renew' },
      { when: f => { const u = lowest(f); return u.hp / u.max < 0.5; }, text: '체력이 확 줄었어요. <b>순간 치유</b>는 1초 만에 채워요. 휠에서 누르고 칸을 탭해요 (마나 두 배).', at: lowest, slot: 'flash', need: 'flash' },
      { when: f => !!firstTel(f, 'buster'), text: '<b>강타 예고</b>: 위에 뜬 기술이 끝나면 탱커가 크게 맞아요. 미리 채워 두세요.' },
      { when: f => !!firstTel(f, 'aoe'), text: '<b>광역 예고</b>: 모두 맞아요. 맞고 나면 가장 낮은 사람부터 채워요.' },
    ],
    dungeon: [
      { when: f => f.mobs.length > 0 && f.t >= 1, freeze: false, text: '던전은 잡몹 구간과 보스를 이어서 해요. 구간 사이엔 쉬면서 마나를 채워요.' },
      { when: f => !!firstTel(f, 'aoe'), text: '<b>광역 예고</b>! 맞기 전에 <b>소생</b>을 걸어 두면 덜 아파요. 위쪽 예고 칸을 누르면 설명이 나와요.' },
      { when: f => f.mana < 30 && Object.keys(f.items).length > 0, text: '마나가 모자라요. 왼쪽 <b>단축칸</b>의 물약을 눌러 보세요.' },
      { when: f => f.zones.length > 0, freeze: false, text: '바닥 장판은 파티원이 알아서 피해요. 못 피한 사람을 채워 주세요.' },
    ],
  };
  const coachEl = document.createElement('div');
  coachEl.id = 'coach'; coachEl.hidden = true;
  $('boardWrap').appendChild(coachEl);
  coachEl.addEventListener('click', e => { if (e.target.closest('[data-coach-ok]')) clearCoach(); });
  function coachCheck() {
    if (!S.coach || S.auto || ui.coach) return;
    const steps = COACH[S.coach] || [], done = S.run.coachDone;
    const i = steps.findIndex((st, k) => !done.has(k) && st.when(F));
    if (i < 0) return;
    done.add(i);
    const st = steps[i];
    const u = st.at ? st.at(F) : null;
    ui.coach = { ...st, uid: u ? u.id : null, freeze: st.freeze !== false, until: st.freeze === false ? performance.now() + 4000 : 0 };
    coachEl.innerHTML = `<p>${st.text}</p>${st.need || st.freeze === false ? '' : '<button class="btn primary" type="button" data-coach-ok>확인</button>'}`;
    coachEl.classList.toggle('top', !!u && center(u.cell).y > ui.layout.H / 2);
    coachEl.hidden = false;
    if (st.slot) { const el = $('wheel').querySelector(`.slot[data-slot="${st.slot}"]`); if (el) el.classList.add('coach-hi'); }
    Snd.play('tick'); vibe(15);
  }
  function clearCoach() {
    ui.coach = null; coachEl.hidden = true;
    $('wheel').querySelectorAll('.coach-hi').forEach(el => el.classList.remove('coach-hi'));
  }
  // 안내가 바란 스킬을 쓰면 다음으로
  function coachUsed(key) { if (ui.coach && ui.coach.need && ui.coach.need === key) clearCoach(); }

  // 칸 탭 기본 힐: 아직 안 배운 스킬로 정해 뒀으면 치유 (06 7장)
  function tapKey() { return F && !E.knows(F, S.tapKey) ? 'heal' : S.tapKey; }
  // 잡몹 구간은 지금 잡는 잡몹 이름을 같이
  function bossTitle() {
    const m = F.mobs.find(x => x.alive);
    return m ? `${F.enc.name} · ${m.name}` : F.enc.name;
  }

  function layoutBattle() {
    const app = $('app');
    const H = app.clientHeight, W = app.clientWidth;
    const enc = F.enc;
    $('stage').style.minHeight = Math.max(enc.big ? 96 : 110, Math.round(H * enc.stage)) + 'px';
    const ch = Math.round(Math.min(250, Math.max(186, H * 0.27)));
    $('controls').style.height = ch + 'px';
    buildWheel(Math.min(ch - 16, W * 0.6));
    resizeBoard();
  }

  // ---------- 스킬 휠 ----------
  function buildWheel(D) {
    const w = $('wheel');
    w.style.width = w.style.height = D + 'px';
    const step = D / 3, b = step * 0.9, core = step * 1.0;
    let html = `<div id="core" style="left:${(D - core) / 2}px;top:${(D - core) / 2}px;width:${core}px;height:${core}px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#2A2C48" stroke-width="6"/><circle id="ringP" cx="50" cy="50" r="46" fill="none" stroke="#F0C46A" stroke-width="6" stroke-linecap="round" stroke-dasharray="0 289"/><circle cx="50" cy="50" r="38" fill="none" stroke="#2A2C48" stroke-width="5"/><circle id="ringS" cx="50" cy="50" r="38" fill="none" stroke="#51C6C0" stroke-width="5" stroke-linecap="round" stroke-dasharray="0 239"/></svg><div id="manaNum">100<small>마나</small></div></div>`;
    DIRS.forEach((it, i) => {
      if (!it) return;
      const x = (i % 3) * step + (step - b) / 2, y = Math.floor(i / 3) * step + (step - b) / 2;
      if (!it.key) { html += `<div class="slot empty" data-dir="${it.d}" style="left:${x}px;top:${y}px;width:${b}px;height:${b}px"><span class="dir">${it.arrow}</span><span class="ct">비어 있음</span></div>`; return; }
      // 아직 안 배운 스킬: 이름과 배우는 레벨만 (누르면 안내)
      if (F && !E.knows(F, it.key)) { html += `<button class="slot locked" type="button" data-lock="${it.key}" data-dir="${it.d}" style="left:${x}px;top:${y}px;width:${b}px;height:${b}px"><span class="dir">${it.arrow}</span><span><span class="nm">${E.SKILLS[it.key].short}</span><span class="ct">🔒 Lv ${E.SKILL_LEVEL[it.key]}</span></span></button>`; return; }
      html += `<button class="slot" type="button" data-slot="${it.key}" data-dir="${it.d}" style="left:${x}px;top:${y}px;width:${b}px;height:${b}px"><span class="cd"></span><span class="dir">${it.arrow}</span><span><span class="nm"></span><span class="ct"></span></span><span class="cds"></span></button>`;
    });
    w.innerHTML = html;
    w.querySelectorAll('.slot[data-slot]').forEach(el => el.addEventListener('pointerdown', ev => { ev.preventDefault(); pressSlot(el.dataset.slot); }));
    w.querySelectorAll('.slot[data-lock]').forEach(el => el.addEventListener('pointerdown', ev => { ev.preventDefault(); const k = el.dataset.lock; toast(`${E.SKILLS[k].name}은(는) Lv ${E.SKILL_LEVEL[k]}에 배워요`); Snd.play('error'); }));
  }
  function pressSlot(slot) {
    if (!F || F.over || paused || ui.pullLeft > 0) return;
    ui.itemArmed = null;
    const key = E.slotKey(F, slot);
    if (E.SKILLS[key].target === 'none') { doUse(key, 0); return; }
    armed = armed === slot ? null : slot;
    vibe(8);
  }

  function updateWheel() {
    const aim = ui.pointer && ui.pointer.dir;
    for (const el of $('wheel').querySelectorAll('.slot')) {
      el.classList.toggle('aim', aim === el.dataset.dir);
      if (!el.dataset.slot) continue;
      const slot = el.dataset.slot, key = E.slotKey(F, slot), sk = E.SKILLS[key];
      const cd = sk.cd ? F.cd[key] : 0;
      const nm = el.querySelector('.nm'), ct = el.querySelector('.ct'), cds = el.querySelector('.cds');
      if (nm.textContent !== sk.short) nm.textContent = sk.short;
      const ctText = sk.cost ? `${sk.cost}%` : '무료';
      if (ct.textContent !== ctText) ct.textContent = ctText;
      el.querySelector('.cd').style.setProperty('--p', cd > 0 ? `${(cd / sk.cd) * 100}%` : '0%');
      const cdt = cd > 0 ? String(Math.ceil(cd)) : '';
      if (cds.textContent !== cdt) cds.textContent = cdt;
      el.classList.toggle('off', cd > 0 || F.mana < sk.cost);
      el.classList.toggle('cooling', cd > 0);
      el.classList.toggle('armed', armed === slot);
      el.classList.toggle('holy', key !== slot);
    }
    const m = Math.floor(F.mana);
    const mn = $('manaNum');
    if (mn.firstChild.textContent !== String(m)) mn.firstChild.textContent = String(m);
    mn.style.color = F.mana < 20 ? '#FF8A7A' : '#9FD3FF';
    $('ringP').setAttribute('stroke-dasharray', `${(F.g.p / 100) * 289} 289`);
    $('ringS').setAttribute('stroke-dasharray', `${(F.g.s / 100) * 239} 239`);
    $('gP').textContent = Math.floor(F.g.p);
    $('gS').textContent = Math.floor(F.g.s);
  }

  // ---------- 소비 아이템 단축칸 ----------
  function buildItems() {
    const keys = Object.keys(F.items);
    let html = '';
    for (let i = 0; i < ITEM_SLOTS; i++) {
      const k = keys[i];
      if (i >= S.slots) { html += `<div class="item empty locked" aria-label="잠긴 칸 (Lv ${SLOT_LV[i]})"><span class="nm">잠김<br>Lv ${SLOT_LV[i]}</span></div>`; continue; }
      if (!k) { html += `<div class="item empty" aria-hidden="true"><span class="nm">빈 칸</span></div>`; continue; }
      html += `<button class="item" type="button" data-item="${k}" aria-label="${E.ITEMS[k].name}">${ITEM_ICON[k]}<span class="nm">${E.ITEMS[k].short}</span><span class="n"></span><span class="cd"></span><span class="cds"></span></button>`;
    }
    $('items').innerHTML = html;
  }
  function updateItems() {
    for (const el of $('items').querySelectorAll('.item[data-item]')) {
      const key = el.dataset.item, it = E.ITEMS[key], left = F.items[key] || 0;
      const cd = it.kind === 'potion' && left > 0 ? F.potCd : 0;
      const n = el.querySelector('.n'), cds = el.querySelector('.cds');
      const nt = `×${left}`; if (n.textContent !== nt) n.textContent = nt;
      el.querySelector('.cd').style.setProperty('--p', cd > 0 ? `${(cd / E.POTION_CD) * 100}%` : '0%');
      const ct = cd > 0 ? String(Math.ceil(cd)) : ''; if (cds.textContent !== ct) cds.textContent = ct;
      el.classList.toggle('off', left <= 0 || cd > 0);
      el.classList.toggle('used', left <= 0);
      el.classList.toggle('armed', ui.itemArmed === key);
    }
  }
  // 누르기 = 나에게 바로 / 대상이 필요한 보호 두루마리는 장전 → 칸 탭. 길게 누르기 = 설명 (보스 기술 팝업과 같은 모양)
  function pressItem(key) {
    const it = E.ITEMS[key];
    if (it.target === 'ally') {
      const r = E.itemReady(F, key);
      if (!r.ok) { toast(r.reason); Snd.play('error'); return; }
      ui.itemArmed = ui.itemArmed === key ? null : key; armed = null;
      if (ui.itemArmed) toast(`${it.name}: 지킬 파티원 칸을 누르세요`);
      vibe(8); return;
    }
    const res = E.useItem(F, key);
    if (!res.ok) { if (res.reason) toast(res.reason); Snd.play('error'); return; }
    vibe(12);
  }
  function openItemTip(key, el) {
    const it = E.ITEMS[key], left = F.items[key] || 0;
    const rule = it.kind === 'potion' ? '물약 공용 재사용 60초' : '전투당 횟수만';
    const tip = $('tip');
    tip.innerHTML = `<div class="t1"><span class="iic">${ITEM_ICON[key]}</span><b>${it.name}</b><span class="tw">${it.desc}</span></div><div class="t2"><span class="lb">팁</span>${it.tip} · 남은 ${left}번 · ${rule}</div>`;
    tip.hidden = false;
    ui.tip = { item: key };
    placeTip(el);
    clearTimeout(ui.tipTimer);
    ui.tipTimer = setTimeout(closeTip, TIP_MS);
    ui.itemTips = (ui.itemTips || 0) + 1;
  }
  $('items').addEventListener('pointerdown', e => {
    const b = e.target.closest('.item[data-item]');
    if (!b || !F || F.over || paused || ui.pullLeft > 0) return;
    e.preventDefault();
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    const P = { key: b.dataset.item, lp: false };
    P.timer = setTimeout(() => { if (ui.itemPress === P) { P.lp = true; openItemTip(P.key, b); vibe(10); } }, 450);
    ui.itemPress = P;
  });
  function endItem(cancelled) {
    const P = ui.itemPress; ui.itemPress = null;
    if (!P) return;
    clearTimeout(P.timer);
    if (P.lp || cancelled || !F || F.over || paused) return;
    pressItem(P.key);
  }
  $('items').addEventListener('pointerup', () => endItem(false));
  $('items').addEventListener('pointercancel', () => endItem(true));
  $('items').addEventListener('contextmenu', e => e.preventDefault());

  function updateCastbar() {
    let label, p = 0;
    if (F.cast) {
      const u = F.party.find(x => x.id === F.cast.uid);
      label = `${E.SKILLS[F.cast.key].name} → ${u ? u.nick : ''}`;
      p = 1 - F.cast.left / F.cast.total;
    } else if (F.channel > 0) {
      label = '천상의 찬가 (칸을 누르면 끊겨요)';
      p = 1 - F.channel / 4;
    } else if (armed) {
      const k = E.slotKey(F, armed);
      label = `${E.SKILLS[k].name} 장전: ${E.SKILLS[k].target === 'area' ? '누른 채 범위를 보고 떼세요' : '대상 칸을 누르세요'}`;
    } else if (F.queued) {
      label = `다음: ${E.SKILLS[F.queued.key].name}`;
    } else {
      label = F.gcd > 0 ? '공통 재사용 대기' : `칸을 탭하면 ${E.SKILLS[tapKey()].name}`;
      p = F.gcd > 0 ? F.gcd / F.gcdBase : 0;
    }
    const cl = $('castLabel');
    if (cl.textContent !== label) cl.textContent = label;
    $('castFill').style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
    $('castFill').style.opacity = F.cast || F.channel > 0 ? 1 : 0.35;
  }

  // ---------- 보스 무대 ----------
  const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
  function updateStage(now) {
    const pct = F.bossHp / F.bossMax;
    $('bossFill').style.width = `${pct * 100}%`;
    $('bossHpText').textContent = `${Math.ceil(F.bossHp).toLocaleString('ko-KR')} (${Math.ceil(pct * 100)}%)${F.invuln ? ' · 무적' : ''}`;
    let ph = F.phaseName ? `${F.enc.tier.split(' · ')[0]} · ${F.phaseName}` : `${F.enc.tier} · ${F.cfg.diff}`;
    if (S.run.segs.length > 1) {
      const left = F.mobs.filter(m => m.alive).length;
      ph = `${S.run.name} ${S.run.idx + 1}/${S.run.segs.length} · ${F.phaseName || (F.mobs.length ? `남은 잡몹 ${left}` : F.cfg.diff)}`;
    }
    if ($('phase').textContent !== ph) $('phase').textContent = ph;
    $('timer').textContent = F.enraged ? `${mmss(F.t)} · 광폭화!` : isFinite(F.enc.enrage) ? `${mmss(F.t)} / 광폭 ${mmss(F.enc.enrage)}` : mmss(F.t);
    if (now - ui.qAt > 90) {
      ui.qAt = now;
      const q = E.queue(F);
      if (F.phaseName === '인터미션' && F.interEnd) q.unshift({ name: '인터미션 끝', icon: '쥐떼', kind: 'inter', impact: F.interEnd, casting: false });
      $('queue').innerHTML = q.map((it, i) => {
        const sec = Math.max(0, it.impact - F.t);
        const col = ICON_COLOR[it.icon] || '#BBB';
        const bar = it.casting ? `<span class="bar" style="transform:scaleX(${Math.min(1, (F.t - it.start) / (it.impact - it.start))})"></span>` : '';
        return `<div class="q${i === 0 ? ' first' : ''}${it.casting ? ' casting' : ''}${tipMatch(it.icon, it.impact) ? ' tipon' : ''}" data-ic="${it.icon}" data-imp="${it.impact.toFixed(2)}"><span class="ic" style="background:${col}">${it.icon}</span><span class="tx"><span class="nm">${it.name}</span><span class="sec">${sec < 10 ? sec.toFixed(1) : Math.ceil(sec)}초</span></span>${bar}</div>`;
      }).join('');
      if (ui.tip) { const qe = $('queue').querySelector('.q.tipon'); if (qe) placeTip(qe); } // 대기열이 다시 그려져도 팝업은 밖에 있어 유지, 순서가 바뀌면 따라감
      const big = q.filter(it => it.casting && (it.kind === 'buster' || it.kind === 'aoe')).sort((a, b) => a.impact - b.impact)[0];
      if (big) {
        const s = Math.ceil(big.impact - F.t);
        if (s !== ui.tickSec && s <= 3 && s >= 1) { ui.tickSec = s; Snd.play('tick'); }
      } else ui.tickSec = null;
      for (const tl of F.tels) if ((tl.kind === 'buster' || tl.kind === 'aoe') && tl.impact - F.t <= 1 && !ui.vibedTel.has(tl.id)) { ui.vibedTel.add(tl.id); vibe(40); }
      const firstBuster = F.tels.find(tl => tl.kind === 'buster' && tl.skill.dmg);
      if (firstBuster && !ui.busterHint && !S.auto) { ui.busterHint = true; toast(`${firstBuster.skill.name}: 탱커에게 ${Math.round(firstBuster.skill.dmg * F.dmgMult)} 피해. 미리 채우거나 수호 영혼`); }
    }
    $('battle').classList.toggle('aoe', F.tels.some(t => t.kind === 'aoe'));
  }

  // ---------- 전투 중 기술 설명 팝업 ----------
  // 예고 칸을 누르면 그 기술이 무엇인지 한 줄로. 게임은 멈추지 않음. 같은 칸 다시 누르기 / 다른 곳 누르기 / 4초 뒤 닫힘.
  // 팝업은 pointer-events: none 이라 아래 판 터치·쓸기를 막지 않고, 닫기용 문서 리스너는 이벤트를 막지 않는다.
  const TIP_MS = 4000;
  // 같은 기술이 대기열에 두 번 있을 수 있어, 누른 그 회차를 맞을 시각(impact)으로 따라감
  const tipMatch = (ic, imp) => !!ui.tip && ui.tip.ic === ic && Math.abs(imp - ui.tip.imp) < 0.2;
  function openTip(ic, qEl) {
    const g = guideModel(F.enc.key, F.cfg.diff);
    const s = g.skills.find(x => x.ic === ic);
    if (!s) { closeTip(); return; }
    const [what] = s.tip(F);
    const tip = $('tip');
    tip.innerHTML = `<div class="t1"><span class="ic" style="background:${ICON_COLOR[ic] || '#BBB'}">${ic}</span><b>${s.name}</b><span class="tw">${what}</span></div>`;
    tip.hidden = false;
    ui.tip = { ic, imp: +qEl.dataset.imp };
    placeTip(qEl);
    clearTimeout(ui.tipTimer);
    ui.tipTimer = setTimeout(closeTip, TIP_MS);
    ui.skillTips = (ui.skillTips || 0) + 1;
    for (const q of $('queue').querySelectorAll('.q')) q.classList.toggle('tipon', tipMatch(q.dataset.ic, +q.dataset.imp));
  }
  function closeTip() {
    clearTimeout(ui.tipTimer);
    ui.tip = null;
    $('tip').hidden = true;
    for (const q of $('queue').querySelectorAll('.q.tipon')) q.classList.remove('tipon');
  }
  // 예고 칸 위쪽(보스 이름·체력 자리)에 띄워 판 맨 윗줄(탱커 자리)을 가리지 않게. 자리가 없으면 아래로
  function placeTip(qEl) {
    const tip = $('tip'), bat = $('battle').getBoundingClientRect(), r = qEl.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const cx = r.left + r.width / 2 - bat.left;
    const left = Math.max(8, Math.min(bat.width - w - 8, cx - w / 2));
    let top = r.top - bat.top - h - 8, below = false;
    if (top < 4) { top = r.bottom - bat.top + 8; below = true; }
    tip.style.left = `${Math.round(left)}px`; tip.style.top = `${Math.round(top)}px`;
    tip.style.setProperty('--ax', `${Math.round(Math.max(14, Math.min(w - 14, cx - left)))}px`);
    tip.classList.toggle('below', below);
  }
  $('queue').addEventListener('pointerdown', e => {
    if (!F || F.over || paused) return;
    const q = e.target.closest('.q');
    if (!q || !q.dataset.ic) { closeTip(); return; }
    if (tipMatch(q.dataset.ic, +q.dataset.imp)) closeTip(); // 같은 칸을 다시 누르면 닫힘, 다른 칸이면 그 칸으로 옮김
    else openTip(q.dataset.ic, q);
  });
  document.addEventListener('pointerdown', e => { if (ui.tip && !$('queue').contains(e.target)) closeTip(); }, true);

  // ---------- 판 그리기 ----------
  const cv = $('board'), ctx = cv.getContext('2d');
  let dpr = 1;
  function resizeBoard() {
    const r = $('boardWrap').getBoundingClientRect();
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    if (!F) return;
    const W = r.width, H = r.height;
    const xs = F.cells.map(c => c.px), ys = F.cells.map(c => c.py);
    const minX = Math.min(...xs), maxX = Math.max(...xs), maxY = Math.max(...ys);
    const s = Math.min((W - 16) / (maxX - minX + Math.sqrt(3)), (H - 16) / (maxY + 2));
    ui.layout = { s, W, H, ox: (W - (maxX - minX) * s) / 2 - minX * s, oy: (H - maxY * s) / 2 };
  }
  new ResizeObserver(() => { if (F && !$('battle').hidden) resizeBoard(); }).observe($('boardWrap'));
  window.addEventListener('resize', () => { if (F && !$('battle').hidden) layoutBattle(); });

  const center = i => { const c = F.cells[i], L = ui.layout; return { x: L.ox + c.px * L.s, y: L.oy + c.py * L.s }; };
  function unitPos(u) {
    if (u.moving) {
      const a = center(u.moving.from), b = center(u.moving.to);
      let p = 1 - u.moving.left / u.moving.total; p = p * p * (3 - 2 * p);
      return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
    }
    return center(u.cell);
  }
  function hexPath(x, y, r) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = (Math.PI / 180) * (60 * k - 30); const px = x + r * Math.cos(a), py = y + r * Math.sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  }
  function hit(x, y) {
    if (!F || !ui.layout) return -1;
    const s = ui.layout.s; let best = -1, bd = Infinity;
    F.cells.forEach((c, i) => { const p = center(i); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
    return bd <= s * 1.1 ? best : -1; // 터치 판정은 칸보다 10% 크게 (기획서 3-1)
  }
  function roleIcon(role, x, y, k) {
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(246,240,224,0.92)'; ctx.strokeStyle = '#0E0E15'; ctx.lineWidth = Math.max(1.5, k * 0.12);
    ctx.beginPath();
    if (role === 'tank') {
      ctx.moveTo(x - k * 0.45, y - k * 0.5); ctx.lineTo(x + k * 0.45, y - k * 0.5); ctx.lineTo(x + k * 0.45, y - k * 0.02);
      ctx.quadraticCurveTo(x + k * 0.4, y + k * 0.4, x, y + k * 0.58); ctx.quadraticCurveTo(x - k * 0.4, y + k * 0.4, x - k * 0.45, y - k * 0.02); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (role === 'melee') {
      ctx.lineWidth = Math.max(3, k * 0.2); ctx.strokeStyle = '#0E0E15';
      ctx.moveTo(x - k * 0.42, y + k * 0.42); ctx.lineTo(x + k * 0.42, y - k * 0.42); ctx.moveTo(x - k * 0.4, y + k * 0.05); ctx.lineTo(x - k * 0.05, y + k * 0.4); ctx.stroke();
      ctx.beginPath(); ctx.lineWidth = Math.max(1.5, k * 0.1); ctx.strokeStyle = 'rgba(246,240,224,0.95)';
      ctx.moveTo(x - k * 0.42, y + k * 0.42); ctx.lineTo(x + k * 0.42, y - k * 0.42); ctx.moveTo(x - k * 0.4, y + k * 0.05); ctx.lineTo(x - k * 0.05, y + k * 0.4); ctx.stroke();
    } else if (role === 'ranged') {
      ctx.lineWidth = Math.max(3, k * 0.18); ctx.strokeStyle = '#0E0E15';
      ctx.arc(x - k * 0.1, y, k * 0.5, -Math.PI / 2.4, Math.PI / 2.4); ctx.moveTo(x + k * 0.03, y - k * 0.47); ctx.lineTo(x + k * 0.03, y + k * 0.47); ctx.moveTo(x - k * 0.45, y); ctx.lineTo(x + k * 0.5, y); ctx.stroke();
      ctx.beginPath(); ctx.lineWidth = Math.max(1.4, k * 0.09); ctx.strokeStyle = 'rgba(246,240,224,0.95)';
      ctx.arc(x - k * 0.1, y, k * 0.5, -Math.PI / 2.4, Math.PI / 2.4); ctx.moveTo(x + k * 0.03, y - k * 0.47); ctx.lineTo(x + k * 0.03, y + k * 0.47); ctx.moveTo(x - k * 0.45, y); ctx.lineTo(x + k * 0.5, y); ctx.stroke();
    } else {
      const t = k * 0.17;
      ctx.rect(x - t, y - k * 0.5, t * 2, k); ctx.rect(x - k * 0.5, y - t, k, t * 2);
      ctx.fillStyle = '#F0C46A'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.fillStyle = '#F0C46A'; ctx.rect(x - t + 1, y - t + 1, t * 2 - 2, t * 2 - 2); ctx.fill();
    }
    ctx.restore();
  }
  // 닉네임: 칸 폭(약 1.45r)에 맞춰 글자를 줄이고, 그래도 길면 끝을 … 로
  function nickText(nick, x, y, r, s) {
    const maxW = r * 1.45;
    let fs = Math.max(9, s * 0.24), t = nick;
    ctx.font = `${fs}px "Jua", "Gowun Dodum", sans-serif`;
    while (ctx.measureText(t).width > maxW && fs > 8.5) { fs -= 0.5; ctx.font = `${fs}px "Jua", "Gowun Dodum", sans-serif`; }
    while (ctx.measureText(t).width > maxW && t.length > 2) t = t.slice(0, t.endsWith('…') ? -2 : -1) + '…';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#0B0B12'; ctx.strokeText(t, x, y);
    ctx.fillStyle = '#F6F0E0'; ctx.fillText(t, x, y);
  }
  function pill(x, y, text, bg, fg, fs) {
    ctx.font = `${fs}px "Jua", "Gowun Dodum", sans-serif`;
    const w = ctx.measureText(text).width + fs * 0.7, h = fs * 1.35;
    ctx.fillStyle = bg; ctx.strokeStyle = '#0E0E15'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 0.5);
  }

  function predictedHeal(u) {
    if (!F.cast) return 0;
    const sk = E.SKILLS[F.cast.key];
    const tgt = F.party.find(x => x.id === F.cast.uid);
    if (!tgt) return 0;
    if (sk.target === 'area') return E.hexDist(F.cells[u.cell], F.cells[tgt.cell]) <= 1 ? sk.amt * F.gear.heal : 0;
    return u === tgt ? sk.amt * F.gear.heal * (u.hot > 0 ? 1.1 : 1) : 0;
  }

  function render(now) {
    const L = ui.layout; if (!L) return;
    const t = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L.W, L.H);
    const s = L.s, r = s * 0.93;
    const pulse = 0.5 + 0.5 * Math.sin(t * 8);
    const rdt = Math.min(0.1, Math.max(0, (now - (ui.lastRender || now)) / 1000)); ui.lastRender = now;
    // 영역 (장판 예고·활성 장판)
    const zoneSet = new Set(), telSet = new Set();
    for (const z of F.zones) z.cells.forEach(i => zoneSet.add(i));
    for (const tl of F.tels) if (tl.kind === 'zone') tl.cells.forEach(i => telSet.add(i));
    // 빈 칸
    F.cells.forEach((c, i) => {
      const p = center(i);
      hexPath(p.x, p.y, r);
      ctx.fillStyle = '#1A1B2E'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#2B2D4A'; ctx.stroke();
      if (zoneSet.has(i)) { hexPath(p.x, p.y, r); ctx.fillStyle = 'rgba(214,72,48,0.55)'; ctx.fill(); }
      else if (telSet.has(i)) { hexPath(p.x, p.y, r); ctx.fillStyle = `rgba(255,74,61,${0.12 + 0.2 * pulse})`; ctx.fill(); }
    });
    // 장전된 범위 미리보기
    const armedKey = armed ? E.slotKey(F, armed) : null;
    const areaArmed = armedKey && E.SKILLS[armedKey].target === 'area';
    let areaCenter = -1;
    if (areaArmed && ui.pointer) areaCenter = hit(ui.pointer.x, ui.pointer.y);
    // 전염 범위 점선
    for (const u of F.party) {
      if (!u.alive) continue;
      const d = u.debuffs.find(x => x.trap);
      if (!d) continue;
      const c0 = F.cells[u.cell];
      F.cells.forEach((c, i) => {
        if (E.hexDist(c, c0) !== 1) return;
        const p = center(i);
        ctx.save(); ctx.setLineDash([3, 4]); hexPath(p.x, p.y, r * 0.98); ctx.lineWidth = 2.5; ctx.strokeStyle = DEB['질병']; ctx.stroke(); ctx.restore();
      });
    }
    // 파티원
    const busterIds = new Set(); for (const tl of F.tels) if (tl.kind === 'buster') tl.units.forEach(id => busterIds.add(id));
    const castTarget = F.cast ? F.cast.uid : -1;
    const tank = F.party.find(u => u.role === 'tank' && u.alive);
    const over = []; // 배지·글자·꼬리표는 칸을 다 그린 뒤 위에 (옆 칸에 가려지지 않게)
    for (const u of F.party) {
      if (!u.alive) {
        if (F.cells[u.cell].unit) continue;
        const p0 = center(u.cell);
        ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#8A8BA0'; ctx.lineWidth = Math.max(2, s * 0.06);
        ctx.beginPath(); ctx.moveTo(p0.x - r * 0.22, p0.y - r * 0.22); ctx.lineTo(p0.x + r * 0.22, p0.y + r * 0.22); ctx.moveTo(p0.x + r * 0.22, p0.y - r * 0.22); ctx.lineTo(p0.x - r * 0.22, p0.y + r * 0.22); ctx.stroke(); ctx.restore();
        continue;
      }
      let { x, y } = unitPos(u);
      if (u.alive && F.t < u.mistakeUntil && F.t > u.mistakeUntil - 0.6) x += Math.sin(t * 70) * s * 0.07;
      if (u.fleeing) x += Math.sin(t * 40) * s * 0.03;
      const shown = ui.disp[u.id] == null ? u.hp : ui.disp[u.id] + (u.hp - ui.disp[u.id]) * Math.min(1, rdt * 14);
      ui.disp[u.id] = shown;
      const frac = Math.max(0, Math.min(1, shown / u.max));
      ctx.save();
      hexPath(x, y, r); ctx.clip();
      ctx.fillStyle = u.alive ? '#20212F' : '#3A3B48'; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      if (u.alive) {
        const pred = predictedHeal(u);
        if (pred > 0) {
          const pf = Math.min(1, (u.hp + pred) / u.max);
          ctx.fillStyle = 'rgba(160,255,170,0.35)'; ctx.fillRect(x - r, y + r - 2 * r * pf, 2 * r, 2 * r * pf);
        }
        ctx.fillStyle = ROLE[u.role].color; ctx.fillRect(x - r, y + r - 2 * r * frac, 2 * r, 2 * r * frac);
        if (u.max < u.base) { // 최대 체력 감소분 = 칸 위쪽 회색 빗금 (채울 수 없는 영역)
          const lost = 1 - u.max / u.base, hh = 2 * r * lost;
          ctx.fillStyle = '#4A4B57'; ctx.fillRect(x - r, y - r, 2 * r, hh);
          ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
          for (let k = -2 * r; k < 2 * r; k += 7) { ctx.beginPath(); ctx.moveTo(x - r + k, y - r); ctx.lineTo(x - r + k + hh, y - r + hh); ctx.stroke(); }
        }
        if (frac < 0.3) { ctx.fillStyle = `rgba(255,59,48,${0.15 + 0.3 * pulse})`; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
        if (u.flash > 0) { ctx.fillStyle = `rgba(255,80,60,${u.flash * 1.4})`; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
        const hk = (now - (ui.hitFx[u.id] || -1e9)) / 300;
        if (hk >= 0 && hk < 1) { const g2 = ctx.createRadialGradient(x, y, 0, x, y, r); g2.addColorStop(0, `rgba(255,248,214,${0.75 * (1 - hk)})`); g2.addColorStop(1, `rgba(255,248,214,${0.2 * (1 - hk)})`); ctx.fillStyle = g2; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
        const gl = ctx.createLinearGradient(x, y - r, x, y + r); gl.addColorStop(0, 'rgba(255,255,255,0.10)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      ctx.restore();
      // 테두리
      hexPath(x, y, r); ctx.lineWidth = Math.max(2.5, s * 0.07); ctx.strokeStyle = '#0B0B12';
      if (u.moving) { ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = '#D8D3C0'; ctx.stroke(); ctx.restore(); } else ctx.stroke();
      if (u.alive) {
        const deb = u.debuffs.slice().sort((a, b) => (b.trap ? 2 : DEB[b.type] && b.type !== '독' ? 1 : 0) - (a.trap ? 2 : DEB[a.type] && a.type !== '독' ? 1 : 0))[0];
        if (deb) {
          ctx.save(); if (deb.trap) ctx.setLineDash([6, 4]);
          hexPath(x, y, r * 0.88); ctx.lineWidth = Math.max(3, s * 0.13); ctx.strokeStyle = DEB[deb.type] || '#E5433D'; ctx.stroke(); ctx.restore();
        }
        if (tank === u) { hexPath(x, y, r * 1.06); ctx.lineWidth = Math.max(2, s * 0.06); ctx.strokeStyle = '#D9342B'; ctx.stroke(); }
        if (zoneSet.has(u.cell) || telSet.has(u.cell)) { hexPath(x, y, r * 1.02); ctx.lineWidth = Math.max(2.5, s * 0.09); ctx.strokeStyle = zoneSet.has(u.cell) ? '#FF5A3D' : `rgba(255,90,61,${0.4 + 0.6 * pulse})`; ctx.stroke(); }
        if (u.guardian > 0) { ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(246,240,224,0.9)'; ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]); }
        // 보호 두루마리: 흰 이중 테두리 (황토 질병·빨간 탱커 표시와 구분), 끝나기 2초 전 깜빡임
        if (u.shield > 0) { ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(237,239,247,${u.shield < 2 ? 0.35 + 0.6 * pulse : 0.95})`; hexPath(x, y, r * 1.12); ctx.stroke(); hexPath(x, y, r * 1.2); ctx.stroke(); ctx.restore(); }
        if (castTarget === u.id) { hexPath(x, y, r * 1.12); ctx.lineWidth = 3; ctx.strokeStyle = SEL; ctx.stroke(); }
        over.push({ u, x, y, deb });
      } else {
        ctx.strokeStyle = '#8A8BA0'; ctx.lineWidth = Math.max(3, s * 0.09);
        ctx.beginPath(); ctx.moveTo(x - r * 0.3, y - r * 0.3); ctx.lineTo(x + r * 0.3, y + r * 0.3); ctx.moveTo(x + r * 0.3, y - r * 0.3); ctx.lineTo(x - r * 0.3, y + r * 0.3); ctx.stroke();
      }
    }
    for (const { u, x, y, deb } of over) {
        // 칸 = 직업 아이콘 · 닉네임 · 체력 (2026-10-07 Lim: 성격 배지는 칸에서 빼고 길게 누르기 정보에만)
        roleIcon(u.role, x, y - r * 0.38, s * 0.34);
        nickText(u.nick, x, y + r * 0.13, r, s);
        ctx.font = `${Math.max(10, s * 0.28)}px "Jua", "Gowun Dodum", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = '#0B0B12'; ctx.strokeText(String(Math.ceil(u.hp)), x, y + r * 0.6);
        ctx.fillStyle = '#FFFFFF'; ctx.fillText(String(Math.ceil(u.hp)), x, y + r * 0.6);
        if (u.hot > 0) {
          const hx = x + r * 0.56, hy = y - r * 0.44, hr = Math.max(7, s * 0.19);
          ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fillStyle = '#51C6C0'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#0B0B12'; ctx.stroke();
          ctx.font = `${hr * 1.05}px "Jua", sans-serif`; ctx.fillStyle = '#0B0B12'; ctx.fillText(String(Math.ceil(u.hot)), hx, hy + 0.5);
        }
        if (deb) {
          const d2 = deb.name === '썩은 숨결' ? `숨결${deb.stack}` : deb.trap ? `⚠전염 ${Math.ceil(deb.left)}` : deb.name;
          pill(x, y - r * 0.8, d2, deb.trap ? '#F6E7B0' : DEB[deb.type] || '#E5433D', '#12131F', Math.max(9, s * 0.2));
          // 다른 종류 디버프도 함께 걸려 있으면 오른쪽에 색 점으로 (질병+독이면 둘 다 보이게)
          const others = [...new Set(u.debuffs.filter(d => d !== deb && d.type !== deb.type).map(d => d.type))];
          others.forEach((ty, k) => { ctx.beginPath(); ctx.arc(x - r * 0.56 + k * r * 0.3, y - r * 0.44, Math.max(4, s * 0.12), 0, Math.PI * 2); ctx.fillStyle = DEB[ty] || '#E5433D'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#0B0B12'; ctx.stroke(); });
        }
        if (F.rats && F.rats.includes(u.id)) pill(x - r * 0.05, y + r * 0.95, '쥐떼', '#B9A38A', '#12131F', Math.max(9, s * 0.18));
        const bt = F.tels.find(tl => tl.kind === 'buster' && tl.units.includes(u.id));
        if (bt && bt.skill.dmg) {
          const sh = u.shield > bt.impact - F.t ? 0.6 : 1; // 맞을 때까지 보호 두루마리가 남아 있으면 -40%
          const dmg = Math.round(bt.skill.dmg * F.dmgMult * sh), lethal = dmg >= u.hp + (u.guardian > 0 ? 1e9 : 0);
          pill(x, y + r * 0.2, `-${dmg}`, lethal ? '#FF3B30' : '#FFB25B', '#12131F', Math.max(11, s * 0.3));
        }
        if (busterIds.has(u.id)) {
          ctx.save(); ctx.strokeStyle = `rgba(255,74,61,${0.6 + 0.4 * pulse})`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.4, y); ctx.moveTo(x + r * 0.4, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y - r * 0.4); ctx.stroke(); ctx.restore();
        }
        if (F.t < u.wrongUntil && F.t > u.wrongUntil - 0.6) pill(x + r * 0.62, y - r * 0.05, '?', '#F0C46A', '#12131F', Math.max(11, s * 0.28));
        else if (F.t < u.mistakeUntil && F.t > u.mistakeUntil - 0.6) pill(x + r * 0.62, y - r * 0.05, '!', '#FF5A3D', '#12131F', Math.max(11, s * 0.28));
        const st = u.fleeing ? ['도망', '#DB9B57'] : u.sulking ? ['삐짐', '#D68FA6'] : null;
        if (st && s >= 40) pill(x, y + r * 0.95, st[0], st[1], '#12131F', Math.max(9, s * 0.18));
        else if (st) { hexPath(x, y, r * 0.95); ctx.lineWidth = 3; ctx.strokeStyle = st[1]; ctx.globalAlpha = 0.5 + 0.5 * pulse; ctx.stroke(); ctx.globalAlpha = 1; }
    }
    // 장전 하이라이트
    if (armedKey) {
      if (areaArmed && areaCenter >= 0) {
        const c0 = F.cells[areaCenter];
        F.cells.forEach((c, i) => { if (E.hexDist(c, c0) <= 1) { const p = center(i); hexPath(p.x, p.y, r * 1.04); ctx.lineWidth = 3; ctx.strokeStyle = SEL; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill(); } });
      } else {
        for (const u of F.party) if (u.alive) { const p = center(u.cell); hexPath(p.x, p.y, r * 1.04); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,255,255,${0.3 + 0.4 * pulse})`; ctx.stroke(); }
      }
    }
    if (!armedKey && ui.itemArmed) for (const u of F.party) if (u.alive) { const p = center(u.cell); hexPath(p.x, p.y, r * 1.04); ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(240,196,106,${0.35 + 0.5 * pulse})`; ctx.stroke(); }
    // 튜토리얼 안내가 짚는 칸
    if (ui.coach && ui.coach.uid != null) {
      const cu = F.party.find(u => u.id === ui.coach.uid);
      if (cu && cu.alive) { const p = unitPos(cu); ctx.save(); hexPath(p.x, p.y, r * (1.18 + 0.06 * pulse)); ctx.lineWidth = 4; ctx.strokeStyle = `rgba(240,196,106,${0.55 + 0.45 * pulse})`; ctx.stroke(); ctx.restore(); }
    }
    // 떠오르는 숫자
    ui.floats = ui.floats.filter(fl => now - fl.t0 < 900);
    for (const fl of ui.floats) {
      const k = (now - fl.t0) / 900;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `${fl.crit ? Math.max(14, s * 0.36) : fl.over ? Math.max(10, s * 0.22) : Math.max(11, s * 0.27)}px "Jua", sans-serif`;
      ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#0B0B12';
      const yy = fl.y - k * s * 0.6;
      ctx.strokeText(fl.text, fl.x, yy); ctx.fillStyle = fl.crit ? '#FFE08A' : fl.over ? '#9C9DB8' : '#8CF29C'; ctx.fillText(fl.text, fl.x, yy);
      ctx.globalAlpha = 1;
    }
    // 쓸기 방향 미리보기
    if (ui.pointer && ui.pointer.dir && ui.pointer.idx >= 0) {
      const P = ui.pointer, it = dirSlot(P.dir), c = center(P.idx);
      const ang = { E: 0, NE: 45, N: 90, NW: 135, W: 180, SW: 225, S: 270, SE: 315 }[P.dir] * Math.PI / 180;
      const ex = c.x + Math.cos(ang) * s * 1.1, ey = c.y - Math.sin(ang) * s * 1.1;
      ctx.save(); ctx.strokeStyle = SEL; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fillStyle = SEL; ctx.fill(); ctx.restore();
      const label = it && it.key ? E.SKILLS[E.slotKey(F, it.key)].name : '비어 있음';
      pill(Math.max(40, Math.min(L.W - 40, ex)), Math.max(14, ey - s * 0.45), label, it && it.key ? '#F6F0E0' : '#5A5B70', '#12131F', Math.max(12, s * 0.28));
    }
    // 20인 탭 확대 미리보기 0.3초 (02 3-1): 손가락에 가리지 않게 칸 위쪽에 1.8배로
    if (ui.lens && now - ui.lens.t0 < 300) {
      const p = center(ui.lens.idx), src = s * 1.15, k = 1.8, R2 = src * k;
      const cx = Math.max(R2 + 2, Math.min(L.W - R2 - 2, p.x)), cy = Math.max(R2 + 2, p.y - s * 1.2 - R2);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (300 - (now - ui.lens.t0)) / 80);
      ctx.beginPath(); ctx.arc(cx, cy, R2, 0, Math.PI * 2); ctx.fillStyle = '#12131F'; ctx.fill(); ctx.clip();
      ctx.drawImage(cv, (p.x - src) * dpr, (p.y - src) * dpr, src * 2 * dpr, src * 2 * dpr, cx - R2, cy - R2, R2 * 2, R2 * 2);
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, R2, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = SEL; ctx.stroke();
    }
    // 말풍선 (동시에 최대 3개, 04 10장)
    ui.bubbles = ui.bubbles.filter(b => now - b.t0 < 1700);
    for (const b of ui.bubbles) {
      const u = F.party.find(x => x.id === b.id); if (!u) continue;
      const p = unitPos(u);
      ctx.font = '12px "Gowun Dodum", sans-serif';
      const w = Math.min(L.W - 8, ctx.measureText(b.text).width + 14), h = 22;
      let bx = Math.max(4, Math.min(L.W - w - 4, p.x - w / 2)), by = p.y - r - h - 6;
      if (by < 2) by = p.y + r + 6;
      ctx.globalAlpha = Math.min(1, (1700 - (now - b.t0)) / 300);
      ctx.fillStyle = '#F6F0E0'; ctx.strokeStyle = '#0B0B12'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(bx, by, w, h, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#12131F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.text, bx + w / 2, by + h / 2 + 0.5);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- 알림 ----------
  function toast(text) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
    const box = $('toast'); box.appendChild(el);
    while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => el.remove(), 2300);
  }
  function banner(text) { const b = $('banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }

  function handleEvents(now) {
    let healSnd = false, critSnd = false;
    for (const ev of F.events) {
      const u = ev.id ? F.party.find(x => x.id === ev.id) : null;
      switch (ev.type) {
        case 'heal': {
          if (!u || !ui.layout) break;
          const p = unitPos(u);
          const over = ev.eff < ev.amt * 0.25; // 거의 다 넘친 힐은 회색으로 작게
          if (ui.floats.length < 40) ui.floats.push({ x: p.x + (Math.random() - 0.5) * ui.layout.s * 0.5, y: p.y - ui.layout.s * 0.3, text: `+${ev.eff}`, crit: ev.crit && !over, over, t0: now });
          ui.hitFx[u.id] = now;
          if (ev.crit) critSnd = true; else healSnd = true;
          break;
        }
        case 'bark':
          if (!ev.text) break;
          ui.bubbles = ui.bubbles.filter(b => b.id !== ev.id);
          ui.bubbles.push({ id: ev.id, text: ev.text, t0: now });
          if (ui.bubbles.length > 3) ui.bubbles.shift();
          break;
        case 'sound':
          Snd.play(ev.name);
          if (ev.name === 'death') vibe(90, true);
          break;
        case 'dispel': if (!ev.trap && !ev.item) vibe([12, 60, 12]); break;
        case 'item': {
          const it = E.ITEMS[ev.key];
          toast(`${it.name}${ev.note ? ` → ${ev.note}` : ''}`);
          Snd.play(it.kind === 'potion' ? 'potion' : 'scroll');
          const el = $('items').querySelector(`[data-item="${ev.key}"]`);
          if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
          break;
        }
        case 'revive':
          if (u && ui.layout) { const p = unitPos(u); ui.floats.push({ x: p.x, y: p.y - ui.layout.s * 0.3, text: '부활', crit: true, over: false, t0: now }); ui.hitFx[u.id] = now; }
          break;
        case 'debuff': {
          const nm = { '질병': 'cough', '독': 'bubble', '마법': 'zap' }[ev.dtype];
          if (nm && now - (ui.debSnd[nm] || 0) > 400) { ui.debSnd[nm] = now; Snd.play(nm); }
          break;
        }
        case 'dps': { const d = $('dpsPop'); d.textContent = `-${ev.amt}`; d.classList.remove('show'); void d.offsetWidth; d.classList.add('show'); break; }
        case 'death': if (u && !u.me) toast(`${u.nick} 쓰러짐`); break;
        case 'msg': toast(ev.text); break;
        case 'phase': banner(ev.text); if (ev.text === '광폭화') vibe([60, 80, 60, 80, 60], true); else vibe(200, true); break;
        case 'gauge': Snd.play('gauge'); toast(`성언: ${ev.which} 준비됨 · 휠에서 장전해 쓰세요`); break;
        case 'mobDown': toast(`${ev.name} 쓰러짐`); $('bossName').textContent = bossTitle(); break;
        case 'over': break;
      }
    }
    if (critSnd) Snd.play('crit');
    else if (healSnd && now - ui.lastHealSnd > 90) { Snd.play('heal'); ui.lastHealSnd = now; }
    F.events.length = 0;
    // 심장 박동: 체력 30% 아래인 사람이 있으면 (가장 낮은 1명 기준, 하나만) (16 7-4)
    if (!F.over && !paused) {
      const lowest = F.party.filter(x => x.alive).reduce((a, b) => (!a || b.hp / b.max < a.hp / a.max ? b : a), null);
      if (lowest && lowest.hp / lowest.max < 0.3 && now - ui.lastHeart > 1100) { ui.lastHeart = now; Snd.play('heart'); }
    }
    // 위험 진동 (체력 30% 아래로 들어갈 때, 3초에 1번)
    for (const u of F.party) {
      const low = u.alive && u.hp / u.max < 0.3;
      if (low && !ui.lowFlags[u.id] && now - ui.lastLowVibe > 3000) { vibe(15); ui.lastLowVibe = now; }
      ui.lowFlags[u.id] = low;
    }
  }

  // ---------- 입력 ----------
  function pt(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function doUse(key, idx) {
    const res = E.use(F, key, idx);
    if (!res.ok) { if (res.reason) toast(res.reason); Snd.play('error'); return false; }
    if (armed && E.slotKey(F, armed) === key) armed = null;
    if (armed && (key === 'serenity' || key === 'sanctify')) armed = null;
    if (E.SKILLS[key].cast > 0 && !res.queued && !res.same) Snd.play('cast');
    coachUsed(key);
    return true;
  }
  cv.addEventListener('pointerdown', e => {
    if (!F || F.over || paused || ui.pullLeft > 0) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    const p = pt(e);
    if (e.pointerType === 'touch') ui.touchSeen = true;
    const P = { x0: p.x, y0: p.y, x: p.x, y: p.y, idx: hit(p.x, p.y), lp: false, moved: false };
    const areaArmed = armed && E.SKILLS[E.slotKey(F, armed)].target === 'area';
    // 광역 장전 중에는 누른 채 범위를 보는 것이 기본 동작이라 롱프레스 미리보기를 끈다 (02 4-1 6번)
    if (!areaArmed) P.timer = setTimeout(() => {
      if (ui.pointer === P && !P.moved && P.idx >= 0 && F.cells[P.idx].unit) { P.lp = true; showPreview(P.idx); }
    }, 450);
    ui.pointer = P;
  });
  cv.addEventListener('pointermove', e => {
    const P = ui.pointer; if (!P) return;
    const p = pt(e); P.x = p.x; P.y = p.y;
    if (Math.hypot(P.x - P.x0, P.y - P.y0) > 12) { P.moved = true; clearTimeout(P.timer); }
    // 장전한 스킬이 없을 때, 파티원 칸에서 시작한 쓸기는 방향 스킬 (쓰는 동안 휠과 칸에 미리 보여줌)
    const nd = !armed && !ui.itemArmed && P.idx >= 0 && F.cells[P.idx].unit ? swipeDir(P.x - P.x0, P.y - P.y0) : null;
    if (nd !== P.dir) { P.dir = nd; if (nd) vibe(5); }
  });
  function endPointer(e, cancelled) {
    const P = ui.pointer; ui.pointer = null;
    if (!P) return;
    clearTimeout(P.timer);
    if (P.lp) { $('preview').hidden = true; return; }
    if (cancelled || !F || F.over || paused) return;
    F.stats.taps++;
    if (ui.itemArmed) { // 보호 두루마리 장전 중: 칸 탭 = 그 파티원에게
      if (P.idx < 0 || !F.cells[P.idx].unit) { F.stats.emptyTaps++; return; }
      const res = E.useItem(F, ui.itemArmed, P.idx);
      if (!res.ok) { if (res.reason) toast(res.reason); Snd.play('error'); return; }
      ui.itemArmed = null; vibe(8); return;
    }
    const dx = P.x - P.x0, dy = P.y - P.y0;
    const key = armed ? E.slotKey(F, armed) : tapKey();
    const area = E.SKILLS[key].target === 'area';
    if (!armed && P.moved) {
      const d = swipeDir(dx, dy), it = d ? dirSlot(d) : null;
      if (!d) { ui.swipeCancel++; return; } // 쓸다가 제자리로 돌아오면 취소
      if (P.idx < 0 || !F.cells[P.idx].unit) { F.stats.missTaps++; return; }
      if (!it || !it.key) { toast('이 방향은 비어 있어요'); ui.swipeEmpty++; return; }
      ui.swipes[d] = (ui.swipes[d] || 0) + 1;
      if (doUse(E.slotKey(F, it.key), P.idx)) vibe(8);
      return;
    }
    if (!area && P.moved && Math.hypot(dx, dy) > 30) return;
    const idx = area ? hit(P.x, P.y) : P.idx;
    if (idx < 0) { F.stats.missTaps++; return; }
    if (!F.cells[idx].unit) { F.stats.emptyTaps++; return; }
    // 터치 정확도: 칸 중심에서 떨어진 정도(칸 크기 대비), 0.7초 안에 옆 칸으로 다시 지정 = 오탭 추정
    const c = center(idx), nowT = performance.now();
    ui.tapOff.push(Math.hypot(P.x - c.x, P.y - c.y) / ui.layout.s);
    if (ui.lastTap && ui.lastTap.idx !== idx && nowT - ui.lastTap.t < 700 && E.hexDist(F.cells[ui.lastTap.idx], F.cells[idx]) === 1) ui.retarget++;
    ui.lastTap = { idx, t: nowT };
    if (F.enc.big && S.zoom) ui.lens = { idx, t0: nowT };
    if (doUse(key, idx)) vibe(8);
  }
  cv.addEventListener('pointerup', e => endPointer(e, false));
  cv.addEventListener('pointercancel', e => endPointer(e, true));
  cv.addEventListener('contextmenu', e => e.preventDefault());

  function showPreview(idx) {
    const u = F.cells[idx].unit;
    const lines = [];
    const cls = u.cls && E.CLASSES[u.cls];
    lines.push(`<b>${u.nick}</b> · ${cls ? `${cls.name} · ` : ''}${ROLE[u.role].name}${u.me ? ' (사제)' : ''}`);
    if (cls) lines.push(`<div class="cpas"><b>${cls.passive}</b> ${cls.passiveDesc}</div>`);
    if (u.p.ch) lines.push(`<div class="pers"><i style="background:${E.CATS[u.p.cat]}">${u.p.ch}</i>${u.pers}: ${u.p.desc}</div>`);
    lines.push(`<div>체력 ${Math.ceil(u.hp)} / ${Math.round(u.max)}${u.max < u.base ? ` (최대 체력 -${Math.round((1 - u.max / u.base) * 100)}%)` : ''}</div>`);
    const items = [];
    for (const d of u.debuffs) items.push(`${d.name} (${d.type}${d.stack ? ` ${d.stack}중첩` : ''}, ${Math.ceil(d.left)}초)${d.type === '독' ? ' · 사제는 해제 불가' : d.trap ? ' · 해제하면 옆 칸으로 퍼짐' : ' · 위로 쓸어 정화'}`);
    if (u.hot > 0) items.push(`소생 ${Math.ceil(u.hot)}초`);
    if (u.guardian > 0) items.push(`수호 영혼 ${Math.ceil(u.guardian)}초`);
    if (u.shield > 0) items.push(`보호 두루마리 ${Math.ceil(u.shield)}초 (받는 피해 -40%)`);
    if (!u.alive) items.push('쓰러짐');
    if (items.length) lines.push(`<ul>${items.map(x => `<li>${x}</li>`).join('')}</ul>`);
    $('preview').innerHTML = lines.join('');
    $('preview').classList.toggle('low', center(idx).y < ui.layout.H / 2);
    $('preview').hidden = false;
    vibe(10);
  }

  // ---------- 일시정지 ----------
  // 일시정지에도 전투 전과 같은 공략을 보여줌 (지금 단계·지금 나오는 기술 표시)
  function setPause(v) {
    if (!F || F.over) return;
    paused = v; $('pause').hidden = !v;
    if (!v) return;
    closeTip();
    const g = guideModel(F.enc.key, F.cfg.diff);
    const ph = g.phases.find(p => p.id === g.cur(F));
    $('pauseSub').textContent = `${mmss(F.t)} · ${ph ? ph.name : ''} · 보스 체력 ${Math.ceil((F.bossHp / F.bossMax) * 100)}%`;
    $('pauseGuide').innerHTML = guideHtml(g, F);
    $('pauseGuide').scrollTop = 0;
    $('pauseAuto').checked = S.auto;
  }
  $('pauseBtn').addEventListener('click', () => setPause(true));
  // 개발 빌드: 일시정지에서 자동 치유 켜고 끄기 (설정에도 저장). 한 번이라도 켜진 판은 자동 힐러 판
  $('pauseAuto').addEventListener('change', e => {
    S.auto = e.target.checked;
    if (S.auto && S.run) S.run.auto = true;
    if (S.onSetting) S.onSetting('auto', S.auto);
  });
  $('resumeBtn').addEventListener('click', () => { Snd.init(); setPause(false); });
  $('restartBtn').addEventListener('click', () => { resetRun(); startBattle(); });
  $('quitBtn').addEventListener('click', () => { if (!F || F.over) return; closeTip(); paused = false; $('pause').hidden = true; finish(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && F && !F.over && !$('battle').hidden) setPause(true); });

  // ---------- 끝: 결과를 새 화면(정산)에 넘김. 던전은 구간 전체 합 ----------
  function finish(quit) {
    const R = S.run, f = F, st = f.stats, win = !quit && f.over === 'win';
    const acc = tapAccuracy(), min = Math.max(1 / 60, f.t / 60);
    if (quit) { R.time += f.t; R.deaths += st.deaths; addStats(R, st); }
    const detail = [
      ['마지막 전투', `${f.enc.name} ${mmss(f.t)}`],
      ['탭', `${st.taps}번 (분당 ${Math.round(st.taps / min)})`],
      ['칸 중심에서 벗어남', acc.n ? `평균 칸 크기의 ${acc.avg}%` : '-'],
      ['옆 칸 재지정 (오탭 추정)', `${ui.retarget}번 · 빈 칸 ${st.emptyTaps}번`],
      ['시전 취소 · 마나 부족', `${st.cancels}번 · ${st.manaFails}번`],
      ['쓸기 스킬', `${Object.values(ui.swipes).reduce((a, b) => a + b, 0)}번 · 취소 ${ui.swipeCancel} · 빈 방향 ${ui.swipeEmpty}`],
      ['소비 아이템', R.itemLog.length ? R.itemLog.map(x => `${E.ITEMS[x.key].short} ${mmss(x.t)}`).join(' · ') : '안 씀'],
    ];
    if (!win) detail.unshift([f.mobs.length ? '잡몹 남은 체력' : '보스 남은 체력', `${Math.ceil((f.bossHp / f.bossMax) * 100)}%`]);
    const result = {
      content: R.content, diff: S.diff, win, quit: !!quit, reason: quit ? '포기했어요' : f.reason,
      segIdx: R.idx, segN: R.segs.length, time: R.time, restSec: R.restSec, deaths: R.deaths,
      healed: R.healed, overheal: R.overheal, dispels: R.dispels, dispellable: R.dispellable,
      endMana: Math.floor(f.mana), minMana: Math.floor(st.minMana), auto: !!(S.auto || R.auto),
      party: f.party.filter(u => !u.me).map(u => ({ nick: u.nick, pers: u.pers, role: u.role, alive: u.alive })),
      detail,
    };
    ui.lastResult = result;
    Snd.play(win ? 'win' : 'lose');
    F = null;
    if (S.onEnd) S.onEnd(result);
  }
  // 아이템은 구간마다 새로 받으니 쓴 기록은 던전 전체 시간으로 모아 둠
  function addStats(R, st) { R.healed += st.healed; R.overheal += st.overheal; R.dispels += st.dispels; R.dispellable += st.dispellable; R.itemLog.push(...F.itemLog.map(x => ({ key: x.key, t: R.time - F.t + x.t }))); }

  function tapAccuracy() {
    const a = ui.tapOff;
    return { n: a.length, avg: a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 100) : null, far: a.filter(v => v > 0.6).length };
  }
  function runData(f) {
    const st = f.stats, tot = st.healed + st.overheal;
    return {
      at: new Date().toISOString(), encounter: f.enc.key, content: S.run.content, segment: S.run.idx,
      runSeconds: Math.round(S.run.time), restSeconds: Math.round(S.run.restSec), boss: f.enc.name, tier: f.enc.tier, diff: f.cfg.diff, gear: f.gear,
      result: f.over, reason: f.reason, seconds: Math.round(f.t), bossLeftPct: Math.ceil((f.bossHp / f.bossMax) * 100),
      deaths: st.deaths, partySize: f.party.length,
      healed: Math.round(st.healed), overhealPct: tot ? Math.round((st.overheal / tot) * 100) : 0,
      minMana: Math.floor(st.minMana), endMana: Math.floor(f.mana), dispels: st.dispels, dispellable: st.dispellable, trapPops: st.trapPops, queueLost: st.queueLost,
      casts: st.casts, taps: st.taps, missTaps: st.missTaps, retarget: ui.retarget, tapOffsetAvgPct: tapAccuracy().avg, tapFar: tapAccuracy().far,
      tapKey: S.tapKey, layout: layoutCode(S.layout), layoutChanged: layoutCode(S.layout) !== layoutCode(DEFAULT_LAYOUT), hand: S.hand, zoom: S.zoom, board: f.board, swipes: ui.swipes, swipeCancel: ui.swipeCancel, swipeEmpty: ui.swipeEmpty,
      emptyTaps: st.emptyTaps, cancels: st.cancels, manaFails: st.manaFails, hymnBroken: st.hymnBroken,
      guideSec: ui.guideSec || 0, skillTips: ui.skillTips || 0, // 전투 전 공략 화면을 본 초 · 전투 중 기술 설명 팝업을 연 횟수
      items: Object.keys(f.items), itemLog: f.itemLog, itemTips: ui.itemTips || 0, itemDispels: st.itemDispels || 0, // 고른 단축칸 · 사용 시각 · 길게 눌러 설명 본 횟수
      personalities: f.party.filter(u => u.pers).map(u => u.pers),
      device: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1, touch: ui.touchSeen },
    };
  }

  // ---------- 구간 끝 · 휴식 (09 S07, 23 4장) ----------
  function endSegment() {
    const R = S.run;
    R.time += F.t; R.deaths += F.stats.deaths; addStats(R, F.stats);
    const next = F.over === 'win' && R.idx < R.segs.length - 1;
    setTimeout(() => { if (F && F.over) { if (next) showRest(); else finish(false); } }, 1200);
  }
  function showRest() {
    const R = S.run, segs = R.segs;
    closeTip();
    ui.restAt = performance.now(); ui.restMana = null;
    $('restSub').textContent = `${R.name} · ${F.enc.name} 끝 (${mmss(F.t)})`;
    $('restSteps').innerHTML = segs.map((k, i) => `<li class="${i <= R.idx ? 'done' : i === R.idx + 1 ? 'next' : ''}">${i <= R.idx ? '✓ ' : ''}${E.ENCOUNTERS[k].name}</li>`).join('');
    const dead = F.party.filter(u => !u.alive && !u.me).length;
    $('restNote').textContent = `파티 체력이 모두 찼어요${dead ? `. 쓰러진 ${dead}명도 일어났어요` : ''}. 마나는 쉬는 동안 초당 ${E.REST_MANA_PER_SEC}%씩 차요. 「계속」은 언제든 누를 수 있어요.`;
    const nk = segs[R.idx + 1];
    const g = guideModel(nk, F.cfg.diff);
    g.tier = `다음 ${R.idx + 2}/${segs.length}`;
    $('restGuide').innerHTML = guideHtml(g, null);
    show('rest');
    $('restBody').scrollTop = 0;
    updateRest(ui.restAt);
  }
  function restSec(now) { return Math.max(0, (now - ui.restAt) / 1000); }
  function updateRest(now) {
    const c = E.restCarry(F, restSec(now));
    if (ui.restMana !== Math.floor(c.mana)) {
      ui.restMana = Math.floor(c.mana);
      $('restFill').style.width = `${c.mana}%`;
      $('restPct').textContent = `${ui.restMana}%`;
    }
    if (S.auto && c.mana >= 100) $('restGo').click(); // 자동 힐러 구경은 마나가 차면 바로 다음 구간
  }
  $('restGo').addEventListener('click', () => {
    if ($('rest').hidden || !S.run) return;
    const sec = restSec(performance.now());
    S.run.carry = E.restCarry(F, sec);
    S.run.restSec += sec;
    S.run.idx++;
    Snd.init();
    startBattle(Math.round(sec));
  });

  // ---------- 루프 ----------
  function updatePull(dt) {
    ui.pullLeft = Math.max(0, ui.pullLeft - dt);
    const n = Math.ceil(ui.pullLeft);
    if (n !== ui.pullShown) {
      ui.pullShown = n;
      const el = $('pullNum'); el.textContent = String(n); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      if (n > 0) Snd.play('tick');
    }
    if (ui.pullLeft <= 0) { $('pull').hidden = true; acc = 0; Snd.play('buster'); banner('전투 시작!'); }
  }
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (F && !$('battle').hidden) {
      if (!paused && !F.over) {
        if (ui.pullLeft > 0) updatePull(dt);
        else {
          coachCheck();
          if (ui.coach && !ui.coach.freeze && now > ui.coach.until) clearCoach();
          if (!(ui.coach && ui.coach.freeze)) {
            acc += dt;
            while (acc >= E.DT && !F.over) { if (S.auto) E.autoHealer(F); E.step(F); acc -= E.DT; }
          }
        }
      }
      handleEvents(now);
      updateStage(now); updateWheel(); updateItems(); updateCastbar();
      render(now);
      if (F.over && !overShown) { overShown = true; endSegment(); }
    }
    if (!$('rest').hidden) updateRest(now);
    requestAnimationFrame(frame);
  }
  window.__proto = { get F() { return F; }, center: i => center(i), guide: (enc, diff) => guideModel(enc, diff), run: () => (F ? runData(F) : null), get pullLeft() { return ui.pullLeft; }, get coach() { return ui.coach; }, get dungeon() { return S.run; }, get last() { return ui.lastResult; } }; // 테스트용 조회
  // 새 화면(src/screens)이 쓰는 입구
  window.__battle = {
    /** 전투 화면에서 바꾼 설정을 저장하게 새 화면에 알림 (일시정지의 자동 치유) */
    set onSetting(fn) { S.onSetting = fn; },
    // o = { content, name, segs, diff, gearStats, level, party, items, slots, seed, onEnd(result) }
    start(o) {
      closeTip();
      S.diff = o.diff; S.gearStats = o.gearStats || null; S.party = o.party; S.items = (o.items || []).slice(); S.slots = o.slots || 4; S.onEnd = o.onEnd || null;
      S.run = { content: o.content, name: o.name, segs: o.segs.slice(), seed0: o.seed != null ? o.seed : null, coachDone: new Set() };
      S.level = o.level || 100;
      S.coach = o.coach || null;
      resetRun();
      Snd.init();
      startBattle(0);
    },
    settings(s) {
      S.sound = !!s.sound; S.vibe = !!s.vibrate; S.hand = s.hand === 'left' ? 'left' : 'right'; S.tapKey = TAP_KEYS[s.tapKey] ? s.tapKey : 'heal';
      S.zoom = s.zoom !== false; S.auto = !!s.auto;
      if (S.auto && S.run) S.run.auto = true;
      S.layout = validLayout(s.layout) ? Object.assign({}, s.layout) : Object.assign({}, DEFAULT_LAYOUT); applyLayout();
    },
    guide: (encKey, diff) => guideHtml(guideModel(encKey, diff), null),
    bossSvg: script => bossSvg(script),
    itemIcon: k => ITEM_ICON[k] || '',
    itemHint: script => ITEM_HINT[script] || '',
    layout: { GRID, ARROW, READ_ORDER, DEFAULT_LAYOUT, LAYOUT_SKILLS, valid: validLayout, label: layoutLabel, text: layoutText },
    tapKeys: TAP_KEYS,
    sound: k => { Snd.init(); Snd.play(k); },
  };
  requestAnimationFrame(frame);
})();
