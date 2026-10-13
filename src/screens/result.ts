/**
 * 결과 화면 (09 S08 정산 + S09 보상을 한 화면으로, 2026-10-08) · P04 레벨업 팝업.
 * 이기면 첫 화면에 등급·별·받은 것, 지면 어디서 졌는지·힌트. 지표·딜미터기는 「전투 기록」에 접어 둠 (지면 펼침)
 */
import { contentOf, type ContentKey } from '../data/content';
import { avgScore, GRADE_STYLE, kindOf, recommendedFor, slotName, type ItemGrade } from '../data/equipment';
import { CLASSES } from '../data/classes';
import { HEROES } from '../data/heroes';
import { MILESTONES, STAR_OVERHEAL, xpToNext } from '../data/progression';
import { Flow, newSeed } from '../game/flow';
import { nextRun } from '../game/next-run';
import { meterHtml } from '../game/meter';
import { G } from '../game/state';
import { scoreOf, specName } from '../game/charinfo';
import { specKeysOf } from '../data/equipment';
import { codexGroupOf, SPEC_GROUPS } from '../data/specials';
import { art } from '../art';
import { TUT } from '../game/tutorial';
import { AFFIXES } from '../data/affixes';
import { ENDING } from '../data/story';
import type { BattleResult, Settlement } from '../game/settle';
import { esc, fmt, go, mmss, screen, topBar } from './kit';
import { currencyIcon, fxArt, gameIcon, gearIcon, placeArt, trinketArt, uiIcon, type CurrencyIconKey } from './art';
import { depart } from './party';

const st = screen('s-settle', '전투 결과', { enter() { render(); } });

/** 머리 뒤에 장소 그림 (28 4장) */
function resArt(k: ContentKey): string {
  const u = placeArt(k).url;
  return u ? ` style="--res-art:url('${u}')"` : '';
}

/** 이름 글자 색 (캐릭터 탭과 같음) */
const GRADE_INK: Record<ItemGrade, string> = { '일반': '#E4E0D8', '고급': '#8BEA9C', '희귀': '#8DBEFF', '영웅': '#D7A6FF', '전설': '#FFC07A' };

function render(): void {
  const r = Flow.result!, x = Flow.settle!;
  const c = contentOf(r.content);
  const won = r.win && !r.quit;
  const tut = G.save.tut < TUT.done || x.tutEnd;
  // 위 정보창은 로비 · 출전과 같은 모양 (설정 칸까지, 2026-10-13 Lim 「헤더 정렬」)
  st.el.innerHTML = `${topBar({ settings: true })}
    <div class="ns-body res">
      ${head(r, x, c.key, c.name)}
      ${tipHtml(r, x)}
      ${won ? lootHtml(r, x) : loseHtml(r, x)}
      ${notesHtml(x)}
      ${recordHtml(r, !won)}
    </div>
    ${footHtml(r, x, tut)}`;
  // 심연의 심장을 처음 멈추면 엔딩 글 (59 4-4, 한 번만). 레벨업 팝업이 있으면 그 위에
  if (won && r.content === 'heart3' && x.first && !ended.has(x) && Object.values(G.save.clears.heart3 ?? {}).reduce((a, c) => a + (c?.n ?? 0), 0) === 1) {
    ended.add(x);
    setTimeout(() => { if (Flow.settle === x && !st.el.hidden) showEnding(st.el); }, 1600);
  }
  // 새로 열린 기능이 있으면 연출이 끝난 뒤 팝업 (한 판에 한 번)
  if (x.levelUps.length && !shown.has(x)) {
    shown.add(x);
    setTimeout(() => { if (Flow.settle === x && !st.el.hidden) showLevelUp(st.el, x.levelUps); }, 1100);
  }
}
const shown = new WeakSet<object>(), ended = new WeakSet<object>();

/** 머리: 제목 · 장소·난이도·어픽스 · (이기면) 등급 + 별 칸 3개, (지면) 원인 */
function head(r: BattleResult, x: Settlement, key: ContentKey, name: string): string {
  const ch = x.chal, won = r.win && !r.quit;
  const kindName = { explore: '탐험', dungeon: '던전', raid: '레이드', event: '이벤트' }[contentOf(key).kind];
  const title = r.quit ? '포기' : !r.win ? '전멸' : ch ? (ch.inTime ? `${ch.stage}단계 돌파` : '시간 초과') : `${kindName} 클리어!`;
  const afx = r.affixes?.length ? ` · ${r.affixes.map(k => AFFIXES[k].name).join('·')}` : '';
  const sub = `${esc(name)} · ${ch ? '주간 도전' : esc(r.diff)}${esc(afx)}${r.auto ? ' · 자동 힐러' : ''}`;
  const badge = x.first ? '<em class="badge">첫 클리어</em>' : x.best ? '<em class="badge">최고 기록</em>' : '';
  let body: string;
  if (won) {
    // 별 칸: 위 ★, 아래 이번 판 값. 못 딴 별은 흐리게 + 기준
    const caps: [string, string][] = [
      [`클리어 ${mmss(r.time)}`, ''],
      [`쓰러짐 ${r.deaths}`, '기준 0'],
      [`오버힐 ${x.overhealPct}%`, `기준 ${Math.round(STAR_OVERHEAL * 100)}%↓`],
    ];
    const n = x.stars.filter(Boolean).length;
    body = `<div class="r-score"><b class="grade" aria-label="등급 ${x.grade}">${x.grade}</b>
      <ol class="r-stars" aria-label="별 ${n}개">${x.stars.map((ok, i) => `<li class="${ok ? 'ok' : ''}"><i aria-hidden="true">★</i><small>${caps[i][0]}</small>${ok || !caps[i][1] ? '' : `<small class="need">${caps[i][1]}</small>`}</li>`).join('')}</ol></div>`;
  } else body = `<p class="r-why">${r.quit ? '보상 없음' : esc(r.reason)}</p>`;
  const hg = uiIcon('hourglass', 'in');
  const chal = !ch ? '' : ch.inTime ? `<p class="r-chal ok">${hg} ${mmss(ch.time)} / ${mmss(ch.limit)} · 제한시간 안${ch.opened ? ` <em class="badge">${ch.stage + 1}단계 열림</em>` : ''}${ch.best > ch.stage ? ` · 이번 주 최고 ${ch.best}단계` : ''}</p>`
    : won ? `<p class="r-chal">${hg} ${mmss(ch.time)} / ${mmss(ch.limit)} · 다음 단계는 안 열림</p>` : '<p class="r-chal">실패 · 단계는 그대로</p>';
  return `<header class="res-head ${won ? (ch && !ch.inTime ? 'win late' : 'win') : 'lose'}"${resArt(key)}>
      <h1>${title}${badge}</h1>
      <p>${sub}</p>
      ${body}
    </header>
    ${chal}${x.cont ? `<p class="note center r-cont">광고로 이어 함 ${x.cont}번 · 등급 최대 B</p>` : ''}`;
}

/** 튜토리얼 안내 (09 4장 · 34 5-2): 녹슨 고원 클리어 = 끝 (첫 장비는 정산에서 바로 장착), 녹슨 요새 쉬움 첫 클리어 = 다음은 보통 */
function tipHtml(r: BattleResult, x: Settlement): string {
  const it = x.items[0], worn = !!it && G.save.gear.equipped[it.slot]?.id === it.id;
  if (x.tutEnd && worn) return '<p class="coachtip"><b>첫 장비</b>를 바로 장착했습니다. 튜토리얼은 여기까지</p>';
  if (x.tutEnd) return '<p class="coachtip">튜토리얼은 여기까지! Lv 3에 탐험 <b>잿빛 공동묘지</b>, Lv 5에 첫 던전 <b>녹슨 요새</b></p>';
  if (r.content === 'rustfort' && x.first && r.diff === '쉬움' && !G.save.clears.rustfort?.['보통']) return '<p class="coachtip">첫 던전 클리어! 다음은 녹슨 요새 <b>보통</b></p>';
  return '';
}

/** 받은 것: 장비 줄 (보스마다 1개) · 재화 칸 · 경험치 줄 */
function lootHtml(r: BattleResult, x: Settlement): string {
  const tiles: string[] = [];
  // 재화는 한 줄 칩 (그림 · +값 · 이름, 2026-10-13 Lim 「골드 · 강화석 UI 점검」)
  const tile = (k: CurrencyIconKey, label: string, v: number, tag = '', sr = '') => `<span class="r-cur"${sr ? ` aria-label="${label} +${fmt(v)} · ${sr}"` : ''}><span class="r-ci">${currencyIcon(k)}${tag}</span><span class="r-cv"><b>+${fmt(v)}</b><small>${label}</small></span></span>`;
  // 공개모집 일일 보너스(×2, 오늘 n/3) · 축제 주간(+20%)은 골드 칸 꼬리표로
  const fest = r.affixes?.includes('festival');
  if (x.gold) tiles.push(tile('gold', '골드', x.gold, x.pubBonus ? '<em>×2</em>' : fest ? '<em>+20%</em>' : '', x.pubBonus ? `공개모집 보너스 오늘 ${x.pubBonus}/3` : fest ? '축제 주간' : ''));
  if (x.crystal) tiles.push(tile('crystal', '크리스탈', x.crystal, '<em>처음</em>'));
  if (x.mats.stone) tiles.push(tile('stone', '강화석', x.mats.stone));
  if (x.mats.refined) tiles.push(tile('refined', '정제 강화석', x.mats.refined));
  if (x.merit) tiles.push(tile('merit', '공훈', x.merit));
  return `<section class="r-loot${x.items.length > 1 ? ' many' : ''}" aria-label="받은 것">
      <h2 class="r-lh">획득 보상</h2>
      ${itemsHtml(x)}
      ${tiles.length ? `<div class="r-curs">${tiles.join('')}</div>` : ''}
      ${xpRow(x)}
    </section>`;
}

/**
 * 받은 장비 줄들 (34 6-7 보스마다 1개). 장착은 캐릭터 탭에서 (2026-10-13 Lim: 「장착」 버튼 · 도감 줄 뺌)
 * 처음 얻은 특수능력은 장비가 여럿이어도 띠 하나로 (42 1-6): 묶음 표식 + 이름, 띠 머리에서 fx-spec-new 한 번 (36 4-6, 효과 줄이기면 없음)
 */
function itemsHtml(x: Settlement): string {
  if (!x.items.length) return x.lootLocked ? '<p class="r-item none">이번 주 이 보스·난이도 장비는 받음 · 월요일 오전 6시에 다시</p>' : '';
  const rows = x.items.map(it => itemRow(it.id)).join('');
  const fresh = x.newSpecs ?? [], pop = G.save.settings.reducedEffects ? '' : fxArt('fx-spec-new', 'r-spnew');
  return rows + (fresh.length ? `<p class="r-newsp"><b>새 특수능력!${pop}</b> ${fresh.map(k => specMark(k) + esc(specName(k))).join(' · ')}</p>` : '');
}

/** 특수능력 묶음 표식 (36 I spec-*, 이름 있는 장신구 = 그 장신구 그림). 그림이 없으면 이름만 */
function specMark(k: string): string {
  const g = codexGroupOf(k), u = g === 'named' ? trinketArt(k) : g ? art(SPEC_GROUPS[g].icon) : '';
  return u ? `<img class="r-spm" src="${u}" alt="" decoding="async" draggable="false">` : '';
}

/** 장비 카드: 부위 그림(등급 색 테두리) · 이름 / 등급 칩 · 점수 (지금 장비보다 ▲▼, 빈 칸이면 「빈칸」) · 부위·종류 / 특수능력 · 입고 있으면 「장착함」 */
function itemRow(id: number): string {
  const eq = G.save.gear.equipped;
  const it = G.save.gear.bag.find(b => b.id === id) || Object.values(eq).find(b => b?.id === id);
  if (!it) return '';
  const worn = eq[it.slot]?.id === it.id, cur = worn ? null : eq[it.slot] ?? null;
  const sc = scoreOf(it), d = sc - scoreOf(cur);
  const act = worn ? '<span class="r-on">장착함</span>' : '';
  const delta = worn ? '' : !cur ? '<em class="up">빈칸</em>' : d > 0 ? `<em class="up">▲${d}</em>` : d < 0 ? `<em class="dn">▼${-d}</em>` : '';
  // 특수능력 이름 (42)
  const sp = specKeysOf(it);
  const spTxt = sp.length ? `<small class="r-sp">${sp.map(k => esc(specName(k))).join(' · ')}</small>` : '';
  // 영웅 · 전설은 장비 칸 뒤로 등급 색 빛기둥 (36 4-6 fx-loot-beam, 흰 그림을 등급 색으로 칠함). 효과 줄이기면 움직이지 않음
  const bu = it.grade === '영웅' || it.grade === '전설' ? art('fx-loot-beam') : '';
  const beam = bu ? `<span class="r-beam${G.save.settings.reducedEffects ? ' calm' : ''}" style="--beam:url('${bu}')" aria-hidden="true"></span>` : '';
  // 고유 장비는 빛기둥 위에 리본 · 별이 한 번 퍼짐 (50 E fx-unique-drop, 장비 칸 뒤). 효과 줄이기면 없음
  const drop = it.unique && !G.save.settings.reducedEffects ? fxArt('fx-unique-drop', 'r-udrop') : '';
  return `<div class="r-item" style="--g:${GRADE_STYLE[it.grade].color};--gi:${GRADE_INK[it.grade]}">
      ${beam}${drop}<span class="r-ic">${gearIcon(it)}</span>
      <span class="r-nm"><b>${esc(it.name)}${it.plus ? ` +${it.plus}` : ''}</b><span class="r-gs"><i class="r-gr">${it.grade}</i><span class="r-sc">점수 ${sc}${delta}</span><small>${slotName(it.slot)} · ${esc(kindOf(it).name)}</small></span>${spTxt}</span>
      ${act}
    </div>`;
}

/** 경험치 줄: 바 + 받은 양 + 지금 레벨 (오르면 강조) */
function xpRow(x: Settlement): string {
  const p = G.save.player, need = xpToNext(p.level), up = x.levelUps.length > 0;
  const w = isFinite(need) ? Math.min(100, (p.xp / need) * 100) : 100;
  return `<div class="r-xpw${up ? ' up' : ''}"><span class="r-lv" aria-hidden="true">${up ? `<small>Lv ${x.levelBefore} →</small>` : '<small>Lv</small>'}<b>${p.level}</b></span>
      <div class="xpbar r-xp${up ? ' up' : ''}" aria-label="경험치 +${fmt(x.xp)} · Lv ${p.level} · ${fmt(p.xp)} / ${isFinite(need) ? fmt(need) : '최대'}"><i style="width:${w}%"></i><span><b>경험치 +${fmt(x.xp)}</b><em>${up ? '레벨 업!' : `${Math.floor(w)}%`}</em></span></div></div>`;
}

/** 진 판: 어디서 졌는지 (구간 점 · 적 남은 체력) · 힌트 (있을 때만). 진 판은 경험치 없음 (2026-10-13 Lim) */
function loseHtml(r: BattleResult, x: Settlement): string {
  if (r.quit) return '';
  const names = r.segNames || [];
  // 구간 길: 점 (✓ 깸 · ✕ 여기서 짐) 아래 구간 이름
  const dots = r.segN > 1 ? `<ol class="r-segs" aria-hidden="true">${Array.from({ length: r.segN }, (_, i) => `<li class="${i < r.segIdx ? 'ok' : i === r.segIdx ? 'x' : ''}"><i>${i < r.segIdx ? '✓' : i === r.segIdx ? '✕' : i + 1}</i>${names[i] ? `<small>${esc(names[i])}</small>` : ''}</li>`).join('')}</ol>` : '';
  const where = r.segN > 1 ? `${r.segIdx + 1}구간${names[r.segIdx] ? ` ${esc(names[r.segIdx])}` : ''}` : esc(names[0] || '보스');
  const left = r.left ? ` · ${r.left.mobs ? '적' : '보스'} 체력 <b>${r.left.pct}%</b> 남음` : '';
  const hints: string[] = [];
  // 힌트는 걸린 것만 (편성 화면 경고 줄과 같은 모양)
  const warn = (v: string, btn = '') => `<p class="f-warn"><i class="f-mark warn" aria-hidden="true">!</i><span class="v">${v}</span>${btn}</p>`;
  if (r.dispellable && r.dispels < r.dispellable) hints.push(warn(`해제 놓침 <b class="f-g">${r.dispellable - r.dispels}</b> / ${r.dispellable}`));
  if (r.minMana <= 10) hints.push(warn(`마나 바닥 <span class="cap">최저 ${r.minMana}%</span>`));
  const rec = recommendedFor(contentOf(r.content), r.diff);
  if (rec && avgScore(G.save.gear.equipped) < rec.score) hints.push(warn(`장비가 권장(${rec.label})보다 낮음`, '<button class="btn2" type="button" data-go="s-char" data-arg="gear">장비</button>'));
  return `<section class="r-prog" aria-label="진행">${dots}<p>${where}${left}</p></section>
    ${hints.length ? `<div class="f-warns">${hints.join('')}</div>` : ''}
`;
}

/** 알림 줄 (누르면 그 화면): 길드원 · 직업 퀘스트 · 인연 · 임무 */
function notesHtml(x: Settlement): string {
  const out: string[] = [];
  const gd = x.guild;
  if (gd?.members.length) {
    const sum = gd.members.reduce((s, m) => s + m.xp, 0);
    const ups = gd.members.filter(m => m.ups.length).map(m => `${esc(m.nick)} Lv ${m.ups[m.ups.length - 1]}`);
    out.push(`<button class="r-note" type="button" data-go="s-guild">${uiIcon('guild')}<span>길드원 경험치 +${fmt(sum)}${ups.length ? ` · <b>${ups.join(' · ')}</b>` : ''}${gd.fame ? ` · 명성 +${gd.fame}` : ''}</span></button>`);
  }
  const q = x.heroQuest;
  if (q) {
    const h = HEROES[q.hero];
    out.push(`<button class="r-note${q.unlocked ? ' hi' : ''}" type="button" data-go="s-char" data-arg="hero">${uiIcon('star')}<span>${q.unlocked ? `<b>${h.name} 해금!</b> 직업에서 바꾸기` : `직업 퀘스트 「${esc(h.unlock.quest!.name)}」 <b>${q.n} / ${q.need}</b>`}</span></button>`);
  }
  if (gd?.scout) out.push(`<button class="r-note hi" type="button" data-go="s-guild">${uiIcon('guild')}<span>인연: <b>${esc(gd.scout.nick)}</b>(${CLASSES[gd.scout.cls].name}) 호감도 최대 · 길드 영입에서 스카우트</span></button>`);
  if (x.missions.length) out.push(`<button class="r-note" type="button" data-go="s-missions" aria-label="임무 완료: ${x.missions.map(esc).join(', ')}">${gameIcon('mission', uiIcon('quest'))}<span>임무 완료 <b>${x.missions.length}</b> · 보상 받기</span></button>`);
  return out.length ? `<div class="r-notes">${out.join('')}</div>` : '';
}

/** 전투 기록 (접힘, 지면 펼침): 딜미터기 상위 5명 · 마지막 전투·소비 아이템 · (개발 빌드) 플레이 기록. 지표 칩 · 「내 치유」 요약은 뺌 (2026-10-13 Lim) */
function recordHtml(r: BattleResult, open: boolean): string {
  const multi = r.segN > 1;
  const dev = G.save.settings.devUnlock && r.dev?.length
    ? `<details class="r-dev"><summary>플레이 기록 (테스트용)</summary><dl class="metrics small">${r.dev.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></details>` : '';
  return `<details class="r-rec"${open ? ' open' : ''}>
      <summary>전투 기록</summary>
      ${r.meter ? meterHtml(r.meter, r.time, { title: multi ? '피해량 · 던전 전체' : '피해량', heal: r.healed, compact: true }) : ''}
      <dl class="metrics small">${r.detail.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${dev}
    </details>`;
}

/**
 * 아래 버튼 (2026-10-13 Lim): [나가기 = 로비] [다시 도전] [다음 탐험 · 던전 · 레이드 (갈 곳 · 난이도)].
 * 다음 갈 곳은 game/next-run (탐험 · 던전은 쉬움 → 보통 → 다음 장소, 기획 70). 주간 도전은 다음 단계가 열렸을 때 「n단계 도전」.
 * 지거나 갈 곳이 없으면 [나가기] [다시 도전]. 튜토리얼 중엔 로비 하나
 */
function footHtml(r: BattleResult, x: Settlement, tut: boolean): string {
  if (tut) return '<footer class="ns-foot"><button class="btn primary" type="button" data-go="s-lobby">로비</button></footer>';
  const nx = nextOf(r, x);
  const next = nx ? `<button class="btn primary r-next" type="button" id="next"><b>${nx.label}</b><small>${esc(nx.sub)}</small></button>` : '';
  return `<footer class="ns-foot ${nx ? 'row3' : 'row2'}">
      <button class="btn" type="button" data-go="s-lobby">나가기</button>
      <button class="btn${nx ? '' : ' primary'}" type="button" id="again">다시 도전</button>
      ${next}
    </footer>`;
}

/** 「다음」 버튼 글: 이긴 판만 */
function nextOf(r: BattleResult, x: Settlement): { label: string; sub: string } | null {
  if (!r.win || r.quit) return null;
  if (x.chal) return x.chal.opened ? { label: `${x.chal.stage + 1}단계 도전`, sub: '주간 도전' } : null;
  const n = nextRun(r.content, r.diff);
  if (!n) return null;
  const c = contentOf(n.content);
  return { label: `다음 ${{ explore: '탐험', dungeon: '던전', raid: '레이드', event: '이벤트' }[c.kind]}`, sub: `${c.name} · ${n.diff}` };
}

st.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (t.closest('#again')) again();
  else if (t.closest('#next')) next();
  else if (t.closest('.m-all')) t.closest('.meter')?.classList.add('all');
});

/** 같은 파티로 바로 다시 (시작 위치는 새로, 주간 도전은 같은 단계). 악몽은 악몽 열쇠가 없으면 못 감 */
function again(): void {
  Flow.seed = newSeed();
  const err = depart();
  if (err) {
    st.el.querySelector('.r-err')?.remove();
    st.el.querySelector('.res')?.insertAdjacentHTML('afterbegin', `<p class="warnbox r-err">${esc(err)}</p>`);
  }
}

/** 다음: 주간 도전은 다음 단계를 같은 파티로 바로, 그 밖엔 다음 장소 · 난이도의 편성 화면 (인원이 달라질 수 있어서) */
function next(): void {
  const r = Flow.result, x = Flow.settle;
  if (!r || !x) return;
  if (x.chal?.opened) { Flow.chal = x.chal.stage + 1; again(); return; }
  const n = nextRun(r.content, r.diff);
  if (!n) return;
  Flow.content = n.content; Flow.diff = n.diff; Flow.chal = 0;
  Flow.party = null; Flow.rerolls = 0;
  go('s-party');
}

// ---------- 엔딩 글 (59 4-4 · 11 6장 햇살 축제) ----------
export function showEnding(host: HTMLElement): void {
  const box = document.createElement('div');
  box.className = 'overlay lvpop ending';
  box.innerHTML = `<div class="card" role="dialog" aria-label="엔딩"><h3>심장이 멈췄다</h3>${ENDING.map(t => `<p>${esc(t)}</p>`).join('')}
    <button class="btn primary" type="button">햇살 축제로</button></div>`;
  box.querySelector('button')!.addEventListener('click', () => box.remove());
  host.appendChild(box);
}

// ---------- 레벨업 팝업 (P04) ----------
/** 새로 열린 기능이 있을 때만 띄움. 적이 내 레벨을 따라오므로 배율은 안 보여 줌 (32 5장) */
export function showLevelUp(host: HTMLElement, ups: number[]): void {
  const items = ups.flatMap(lv => (MILESTONES[lv] || []).filter(m => m.live).map(m => ({ lv, ...m })));
  if (!items.length) return;
  const box = document.createElement('div');
  box.className = 'overlay lvpop';
  box.innerHTML = `<div class="card" role="dialog" aria-label="레벨 업"><h3>레벨 업!</h3><p class="lvnum">Lv ${ups[0] - 1} → <b>${ups[ups.length - 1]}</b></p>
    <ul>${items.map(m => `<li>Lv ${m.lv} · ${esc(m.text)}</li>`).join('')}</ul>
    <button class="btn primary" type="button">확인</button></div>`;
  box.querySelector('button')!.addEventListener('click', () => box.remove());
  host.appendChild(box);
}
