/**
 * S04 입장 (27 3-2, 시안 Entry27): 상단 = 세력 문양 · 이름 · 인원·보스, 난이도 폴더 탭, 레벨 단계 칩 (07 3장),
 * 준비 확인 (레벨 · 장비 · 해제 · 입장권, 미달이면 경고만), 구간 (노드 줄 + 보스별 공략 접기 + 단계 어픽스), 보상 (등급 색 막대), 아래 고정 「편성으로」.
 * 주간 도전은 단계 고르기 · 어픽스 · 제한시간 (13 3-2).
 */
import { ALL_DIFFS, contentOf, isRaid, raidSize, stageOf, type ContentDef } from '../data/content';
import { DIFFS, MYTHIC, type DiffName } from '../data/difficulty';
import { ENCOUNTERS, segGrade, type EncounterKey } from '../data/encounters';
import { avgScore, DROP_TABLE, gearSummary, GRADE_STYLE, ITEM_GRADES, LEGEND_LEVEL, RECOMMENDED } from '../data/equipment';
import { canDispel, DEB_COLOR, HEROES } from '../data/heroes';
import { setOf } from '../data/sets';
import { clearGold, clearXp } from '../data/progression';
import { MERIT, MERIT_WEEK_CAP, SHARD_MAX } from '../data/economy';
import { Flow } from '../game/flow';
import { chalChestOf, needsShard, raidLootOpen } from '../game/economy';
import { AFFIXES, type AffixKey } from '../data/affixes';
import { CHAL } from '../data/challenge';
import { runMode, tierGate } from '../game/runmode';
import { G, heroNow, lockOf, switchOpen } from '../game/state';
import { TUT } from '../game/tutorial';
import { battle, esc, fmt, go, mmss, screen } from './kit';
import { LOCK, placeArt, uiIcon } from './art';
import { markHtml } from './content';

const svg = (d: string, sw = 2.2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const BACK = svg('<path d="M19 12H5M11 6l-6 6 6 6"/>');
export const ARROW = svg('<path d="M5 12h14M13 6l6 6-6 6"/>');
/** 종 조각 (악몽 입장권) */
const BELL = svg('<path d="M6.5 16v-4.5a5.5 5.5 0 0 1 11 0V16l1.5 2h-14z"/><path d="M10 20.5h4"/>', 2);
const CHEV = '<svg class="f-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

/** 흐름 화면 상단 (입장·편성 공통, 시안 .hd): 뒤로 · (문양) · 제목 · 오른쪽 작은 글 */
export function flowHead(back: string, title: string, cap: string[], mark = ''): string {
  return `<header class="topbar f-hd"><button class="tb-back" type="button" data-go="${back}" aria-label="뒤로">${BACK}</button>${mark}<b class="f-ttl">${esc(title)}</b><span class="f-sp"></span><span class="cap f-hcap">${cap.map(x => `<span>${x}</span>`).join('')}</span></header>`;
}

/** 장비 점수 → 등급 + 강화 글 (itemScore = 등급 순위 + 강화/10, 평균이라 섞인 장비는 중간값) */
function gradeOf(score: number): string {
  const i = Math.floor(score + 1e-6) - 1;
  if (i < 0) return '';
  const g = ITEM_GRADES[Math.min(i, ITEM_GRADES.length - 1)], plus = Math.round((score - Math.min(i, ITEM_GRADES.length - 1) - 1) * 10);
  return `<b class="f-g" style="color:${GRADE_STYLE[g].color}">${g}</b>${plus > 0 ? ` +${plus}` : ''}`;
}
function myGear(): string {
  const avg = avgScore(G.save.gear.equipped);
  return avg >= 1 ? gradeOf(avg) : avg > 0 ? esc(gearSummary(G.save.gear.equipped)) : '장비 없음';
}

/** 준비 확인 한 줄: ✓ / ! (mark 없으면 정보 줄) */
function ck(mark: 'ok' | 'warn' | null, label: string, v: string, cls: string, right = ''): string {
  const m = mark ? `<span class="f-mark ${mark}" role="img" aria-label="${mark === 'ok' ? '충족' : '주의'}">${mark === 'ok' ? '✓' : '!'}</span>` : '<span class="f-mark info" aria-hidden="true"></span>';
  return `<div class="f-ck ${cls}${mark ? '' : ' info'}">${m}<b>${label}</b><span class="v">${v}</span>${right}</div>`;
}

/** 해제 줄 (25 7장): 이 콘텐츠가 거는 디버프를 지금 직업이 지울 수 있는지. 못 지우면 ! + 직업 바꾸기 */
function dispelCk(segs: EncounterKey[]): string {
  const types = [...new Set(segs.flatMap(k => ENCOUNTERS[k].debuffs || []))];
  if (!types.length) return ck('ok', '해제', '물리만 · 해제 필요 없음', 'dispel');
  const h = heroNow(), miss = types.filter(t => !canDispel(h, t));
  const chips = types.map(t => { const ok = canDispel(h, t); return `<span class="dsp${ok ? '' : ' cant'}" style="--c:${DEB_COLOR[t] || '#888'}">${t} ${ok ? '✓' : '✕'}</span>`; }).join('');
  const swap = miss.length && switchOpen().ok ? '<button class="btn2" type="button" data-go="s-char" data-arg="hero">직업 바꾸기</button>' : '';
  return ck(miss.length ? 'warn' : 'ok', '해제', `<span class="cap">${HEROES[h].name}</span>${chips}`, 'dispel', swap);
}

/** 구간 노드 줄: 일반·정예 ● · 보스 ◆ */
function timeline(segs: EncounterKey[]): string {
  return `<ol class="segs f-tl" aria-label="구간 ${segs.length}개">${segs.map(k => {
    const e = ENCOUNTERS[k], g = segGrade(e);
    return `<li class="${e.script === 'trash' ? 'trash' : 'boss'}${g === '정예' ? ' elite' : ''}"><span class="f-ndw"><i class="f-nd"></i></span><span class="f-nl">${g === '보스' ? esc(e.name) : g}</span></li>`;
  }).join('')}</ol>`;
}

/** 구간별 공략 접기: 누르면 기술 목록 (전투 공략 데이터 그대로) */
function guides(segs: EncounterKey[], d: DiffName, stage: number): string {
  return `<div class="guides">${segs.map((k, i) => {
    const html = battle().guide(k, d, stage, G.save.player.level);
    const n = (html.match(/class="gs[ "]/g) || []).length, g = segGrade(ENCOUNTERS[k]);
    return `<details class="gdet f-acc"${segs.length === 1 && i === 0 ? ' open' : ''}><summary>${CHEV}<span class="f-an">${esc(ENCOUNTERS[k].name)}</span><span class="f-sp"></span><span class="cap">${g === '보스' ? '' : `${g} · `}기술 ${n}</span></summary>${html}</details>`;
  }).join('')}</div>`;
}

/** 어픽스 줄 (07 3장, 13 3-3): 빨간 이름 칸 + 설명 */
function afxRows(keys: AffixKey[], label = ''): string {
  if (!keys.length) return '';
  return `<div class="afxlist">${keys.map(k => {
    const a = AFFIXES[k];
    return `<div class="f-afr"><span class="f-afx${a.good ? ' good' : ''}">${a.name}</span><span class="f-afd">${label ? `${label} · ` : ''}${esc(a.desc)}<small>${esc(a.tip)}</small></span></div>`;
  }).join('')}</div>`;
}

/** 드롭 확률 막대 (등급 색 한 줄, 좁은 칸은 글자를 설명 줄로) */
function dropBar(d: DiffName): { bar: string; small: string[] } {
  const table = DROP_TABLE[d].map((p, i) => [ITEM_GRADES[i], p] as const).filter(([, p]) => p > 0);
  const pc = (p: number) => `${Math.round(p * 100)}%`;
  const bar = `<div class="f-drop" role="img" aria-label="장비 등급 확률 ${table.map(([g, p]) => `${g} ${pc(p)}`).join(', ')}">${table.map(([g, p]) => `<span style="width:${(p * 100).toFixed(1)}%;background:${GRADE_STYLE[g].color}">${p >= 0.15 ? `${g} ${pc(p)}` : ''}</span>`).join('')}</div>`;
  return { bar, small: table.filter(([, p]) => p < 0.15).map(([g, p]) => `${g} ${pc(p)}`) };
}

function setTxt(c: ContentDef): string {
  if (!c.set) return '';
  const s = setOf(c.key);
  return s ? `세트 ${s.name} (${s.minGrade} 이상)` : `세트 ${esc(c.set)}`;
}

/** 상단 + 난이도 탭을 장소 그림 위에 (그림이 있으면 어둡게 깔림, 28 4장 입장 머리) */
function cover(c: ContentDef, inner: string): string {
  const pa = placeArt(c.key);
  return `<div class="f-cover${pa.url ? ' art' : ''}"${pa.url ? ` style="--cv:url('${pa.url}')"` : ''}>${inner}</div>`;
}

const s = screen('s-entry', '입장', { enter() { render(); } });

function diffNote(d: DiffName, raid: boolean): string {
  const x = DIFFS[d];
  let t = `받는 피해 ×${x.dmg} · 파티원 회피 ${Math.round(x.dodge * 100)}%`;
  if (d === '악몽') t += ` · 파티원 체력·딜 ×${MYTHIC.party} · 보스 체력 ×${MYTHIC.bossHp}${raid ? ' · 보스마다 악몽 전용 기술' : ''}`;
  return t;
}

function render(): void {
  if (Flow.chal) { renderChal(); return; }
  const c = contentOf(Flow.content);
  const raid = isRaid(c);
  if (lockOf(c, Flow.diff).locked) Flow.diff = '보통';
  const d = Flow.diff;
  const tutDone = G.save.tut >= TUT.done;
  // 던전 레벨 단계 (07 3장): 튜토리얼 뒤, 레벨이 되면 (개발 빌드는 전부)
  if (!tutDone || !c.tiers?.includes(Flow.tier) || !tierGate(G.save, Flow.tier).ok) Flow.tier = 0;
  const mode = runMode(G.save, c, d, { tier: Flow.tier, chal: 0 });
  const segs = c.fights(d);
  const rec = RECOMMENDED[d];
  const warn = !!rec && avgScore(G.save.gear.equipped) < rec.score;
  const lv = G.save.player.level, stage = mode.stage, rs = raidSize(c);
  const legendCut = lv < LEGEND_LEVEL && DROP_TABLE[d][ITEM_GRADES.indexOf('전설')] > 0;
  const goldA = clearGold(stage, d, 'A', rs), goldS = clearGold(stage, d, 'S', rs);
  const xpA = clearXp(lv, stage, d, 'A', { raid: rs, win: true });
  const shardOn = tutDone && needsShard(d), shards = G.save.wallet.shards;
  const lootDone = tutDone && !!rs && !raidLootOpen(G.save, c.key, d);
  const lk = lockOf(c, d);

  // 레벨 단계 칩: 열린 단계 + 다음 잠긴 단계 하나 (시안)
  let more = true;
  const tiers = tutDone && c.tiers ? c.tiers.filter(t => { if (!more) return false; if (!tierGate(G.save, t).ok) more = false; return true; }) : [];
  const tierRow = tiers.length ? `<div class="f-tiers" role="radiogroup" aria-label="레벨 단계"><span class="cap">레벨 단계</span><button class="f-tier" type="button" role="radio" data-tier="0" aria-checked="${!Flow.tier}">Lv ${stageOf(c, d)}</button>${tiers.map(t => {
    const g = tierGate(G.save, t);
    return `<button class="f-tier" type="button" role="radio" data-tier="${t}" aria-checked="${t === Flow.tier}"${g.ok ? '' : ' disabled'}>${g.ok ? '' : LOCK}Lv ${t}</button>`;
  }).join('')}</div>` : '';

  const drop = dropBar(d);
  const rw = ['장비 1개', ...drop.small, setTxt(c), `골드 ${fmt(goldA)} (S ${fmt(goldS)})`, `경험치 약 ${fmt(xpA)}`].filter(Boolean);
  if (rs && tutDone) rw.push(`공훈 ${MERIT[rs][d]} (이번 주 ${G.save.weekly.merit[rs]}/${MERIT_WEEK_CAP})`);
  // 레이드 이번 주 장비 (보스마다 난이도별 주 1회, 13 3-4)
  const lootLine = rs && tutDone ? `<span class="cap f-lootl${lootDone ? ' done' : ''}">이번 주 이 보스 장비 ${lootDone ? '받음 · 골드·공훈만 (월요일 오전 6시에 다시)' : '아직'}</span>` : '';

  const ticket = shardOn
    ? ck(shards ? 'ok' : 'warn', '입장권', `종 조각 1개 씀 · 가진 것 ${shards}/${SHARD_MAX} <span class="cap${shards ? '' : ' f-sub'}">${shards ? '져도 안 돌아옴' : '상점에서 제작 · 주간 임무'}</span>`, 'ticket', shards ? '' : '<span class="f-under">없음</span>')
    : '';

  s.el.innerHTML = `${cover(c, `${flowHead('s-content', c.name, [`${c.size(d)}인 · 보스 ${c.bosses.length}`, `단계 Lv ${stage}`], markHtml(c, 'sm'))}
      <nav class="subtabs f-dtabs" role="radiogroup" aria-label="난이도">${ALL_DIFFS.map(x => {
        const l = lockOf(c, x);
        return `<button type="button" role="radio" data-diff="${x}" aria-checked="${x === d}"${l.locked ? ' disabled' : ''}>${x}${l.locked ? `<small>${LOCK}${l.lv}</small>` : ''}</button>`;
      }).join('')}</nav>`)}
    <div class="ns-body f-ebody">
      ${G.save.tut === TUT.dungeon && c.key === 'rustfort' ? '<p class="coachtip">처음엔 <b>쉬움</b> 추천. 깨고 나면 보통 도전. 아래 공략은 눌러서 펼침</p>' : ''}
      ${tierRow}
      <p class="note f-dnote">${esc(diffNote(d, raid))}${lk.dev ? ` · Lv ${lk.lv} 해금, 개발 빌드라 열림` : ''}${Flow.tier && tierGate(G.save, Flow.tier).dev ? ` · 레벨 단계 Lv ${Flow.tier}, 개발 빌드라 열림` : ''}</p>

      <section class="pn gold f-sec f-ready"><h2 class="h-rule">준비 확인<span class="rule"></span></h2>
        ${ck(lv >= stage ? 'ok' : 'warn', '레벨', `권장 ${stage} · 내 ${lv}`, 'lv')}
        ${ck(warn ? 'warn' : 'ok', '장비', `권장 ${rec ? gradeOf(rec.score) : '없음'} · 내 ${myGear()}`, 'gear', warn ? '<span class="f-under">미달 · 입장은 됨</span>' : '')}
        ${dispelCk(segs)}
        ${ticket}
      </section>

      <section class="pn f-sec"><h2 class="h-rule">구간<span class="rule"></span><span class="cap">${segs.length > 1 ? '구간 사이 휴식' : '보스 1'}</span></h2>
        ${timeline(segs)}
        ${guides(segs, d, stage)}
        ${afxRows(mode.affixes, '단계 어픽스')}
      </section>

      <section class="pn f-sec f-rw"><h2 class="h-rule">보상<span class="rule"></span></h2>
        ${drop.bar}
        <span class="cap">${rw.map(x => `<span class="f-nw">${x}</span>`).join(' · ')}</span>
        ${legendCut ? `<span class="cap">전설은 Lv ${LEGEND_LEVEL}부터 (그 전엔 영웅)</span>` : ''}
        ${lootLine}
      </section>
    </div>
    <footer class="ns-foot f-foot"><button class="f-go" type="button" id="entryGo">${shardOn ? BELL : uiIcon('battle')}<span class="cta2"><span class="f-gt">편성으로</span><small>${shardOn ? '종 조각 1개 씀 · ' : ''}${d} · 단계 Lv ${stage}</small></span>${ARROW}</button></footer>`;
}

/** 주간 도전 (13 3-2): 단계 고르기, 이번 주 어픽스, 제한시간, 월요일 상자 */
function renderChal(): void {
  const c = contentOf(Flow.content), d = Flow.diff, open = G.save.chalOpen;
  Flow.chal = Math.max(1, Math.min(open, CHAL.max, Flow.chal));
  const m = runMode(G.save, c, d, { tier: 0, chal: Flow.chal });
  const segs = c.fights(d), best = G.save.weekly.chalBest, bm = m.bossMult!;
  const festival = m.affixes.includes('festival');
  const gold = Math.round(clearGold(m.stage, d, 'A') * (festival ? CHAL.festivalGold : 1));
  const xp = clearXp(G.save.player.level, m.stage, d, 'A', { win: true });
  const box = best ? chalChestOf(best) : null;
  s.el.innerHTML = `${cover(c, flowHead('s-content', CHAL.name, [`주간 도전 · ${esc(c.name)} ${d}`, `단계 Lv ${m.stage}`], `<span class="f-hg sm">${uiIcon('hourglass')}</span>`))}
    <div class="ns-body f-ebody">
      <div class="chalstep"><button class="btn2" type="button" data-cstep="-1" aria-label="한 단계 아래"${Flow.chal <= 1 ? ' disabled' : ''}>−</button><b>${Flow.chal}단계</b><button class="btn2" type="button" data-cstep="1" aria-label="한 단계 위"${Flow.chal >= open ? ' disabled' : ''}>+</button></div>
      <p class="note center">열린 단계 ${open}/${CHAL.max} · 이번 주 최고 ${best ? `${best}단계` : '없음'}</p>
      <section class="pn gold f-sec f-ready"><h2 class="h-rule">준비 확인<span class="rule"></span></h2>
        ${ck(null, '던전', `${esc(c.name)} ${d} · ${c.size(d)}인`, 'run')}
        ${ck(null, '단계', `Lv ${m.stage} (내 레벨 기준)`, 'lv')}
        ${ck(null, '제한', `${mmss(m.limit!)} <span class="cap">휴식 뺀 전투 시간 합</span>`, 'limit')}
        ${ck(null, '적', `체력 +${Math.round((bm.hp - 1) * 100)}% · 피해 +${Math.round((bm.dmg - 1) * 100)}%`, 'foe')}
        ${ck(null, '장비', `내 ${myGear()}`, 'gear')}
        ${dispelCk(segs)}
      </section>
      <section class="pn f-sec"><h2 class="h-rule">이번 주 어픽스<span class="rule"></span><span class="cap">월요일 오전 6시에 바뀜</span></h2>${afxRows(m.affixes)}</section>
      <section class="pn f-sec"><h2 class="h-rule">규칙<span class="rule"></span></h2><ul class="f-rules"><li>제한시간 안에 깨면 다음 단계 열림</li><li>실패해도 단계 유지 · 종 조각 소모 없음</li><li>광고 이어하기 없음</li></ul></section>
      <section class="pn f-sec"><h2 class="h-rule">구간<span class="rule"></span></h2>${timeline(segs)}</section>
      <section class="pn f-sec f-rw"><h2 class="h-rule">보상<span class="rule"></span></h2>
        <span class="cap">판마다: 장비 1개 · 골드 ${fmt(gold)}${festival ? ' (축제 주간 +20%)' : ''} · 경험치 약 ${fmt(xp)}</span>
        <span class="cap">월요일 도전 상자: 이번 주 최고 단계 기준 · 5단계 희귀 · 10단계 영웅 · 15단계 영웅 2개 · 20단계 전설 확률</span>
        ${box ? `<span class="cap">지금 기록이면 ${box.grades.join(' · ')}${box.legend ? ' · 전설 확률' : ''}</span>` : ''}
      </section>
    </div>
    <footer class="ns-foot f-foot"><button class="f-go" type="button" id="entryGo">${uiIcon('hourglass')}<span class="cta2"><span class="f-gt">편성으로</span><small>주간 도전 ${Flow.chal}단계 · 단계 Lv ${m.stage}</small></span>${ARROW}</button></footer>`;
}

s.el.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-diff]');
  if (b && !b.disabled) { Flow.diff = b.dataset.diff as DiffName; render(); return; }
  const tb = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tier]');
  if (tb && !tb.disabled) { Flow.tier = Number(tb.dataset.tier); render(); return; }
  const cs = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cstep]');
  if (cs && !cs.disabled) { Flow.chal += Number(cs.dataset.cstep); render(); return; }
  if ((e.target as HTMLElement).closest('#entryGo')) { Flow.party = null; Flow.rerolls = 0; go('s-party'); }
});
