/**
 * 결과 화면 (09 S08 정산 + S09 보상을 한 화면으로, 2026-10-08) · P04 레벨업 팝업.
 * 이기면 첫 화면에 등급·별·받은 것, 지면 어디서 졌는지·힌트. 지표·딜미터기는 「전투 기록」에 접어 둠 (지면 펼침)
 */
import { setResultWin } from '../bgm';
import { nickOf, t, tc } from '../i18n';
import { STAT_NAMES, type StatKey } from '../data/fm';
import { CLASSES } from '../data/classes';
import { EXPED, guildLvOf, REQ } from '../data/guild';
import { FEATURES } from '../data/features';
import { contentOf, type ContentKey } from '../data/content';
import { GRADE_STYLE, kindOf, qualityOf, slotName, type ItemGrade } from '../data/equipment';
import type { HeroKey } from '../data/heroes';
import { STAR_OVERHEAL, xpToNext } from '../data/progression';
import { levelUpMilestones } from '../data/milestones';
import { Flow, newSeed } from '../game/flow';
import { nextRun } from '../game/next-run';
import { meterHtml } from '../game/meter';
import { G, heroNow } from '../game/state';
import { gearName, scoreOf, specName } from '../game/charinfo';
import { specKeysOf } from '../data/equipment';
import { art } from '../art';
import { TUT } from '../game/tutorial';
import { AFFIXES } from '../data/affixes';
import { chalReward } from '../data/challenge';
import { ENDING } from '../data/story';
import type { BattleResult, Settlement } from '../game/settle';
import { esc, fmt, mmss, ROLE, screen, topBar, milestoneText } from './kit';
import { classIcon } from './members';
import { currencyIcon, fxArt, gameIcon, gearIcon, placeArt, uiIcon, type CurrencyIconKey } from './art';
import { depart } from './party';
import { sortie } from './stamina';
import { adsFree } from '../game/stamina';
import { adClockMs, interstitialDue, interstitialOff, showInterstitial } from '../platform/ads';
import { sheetDialog } from './dialog';
import { openItemDetail } from './character';
import { sfx } from '../sfx';
import { lootSound } from './ui-sound';

let itemDetailOpen = false;
let deferredPopups: (() => void)[] = [];
const st = screen('s-settle', '전투 결과', { enter() { itemDetailOpen = false; deferredPopups = []; setResultWin(!!Flow.result?.win && !Flow.result?.quit); render(); } });
const resultModal = sheetDialog(st.el, () => closeResultPopup(st.el));

/** 머리 뒤에 장소 그림 (28 4장) */
function resArt(k: ContentKey): string {
  const u = placeArt(k).url;
  return u ? ` style="--res-art:url('${u}')"` : '';
}

/** 이름 글자 색 (캐릭터 탭과 같음) */
const GRADE_INK: Record<ItemGrade, string> = { '일반': '#E4E0D8', '고급': '#8BEA9C', '희귀': '#8DBEFF', '영웅': '#D7A6FF', '전설': '#FFE680' };

function render(): void {
  resultModal.beforeRender();
  const r = Flow.result!, x = Flow.settle!;
  const c = contentOf(r.content);
  const won = r.win && !r.quit;
  const tut = G.save.tut < TUT.done || x.tutEnd;
  // 휴식 보너스 연출은 이 판 처음 그릴 때 한 번 (다시 그리면 합계 그대로), 시각 효과 줄이기면 없음
  const anim = won && !!x.restBonus && !G.save.settings.reducedEffects && !restPlayed.has(x);
  if (anim) restPlayed.add(x);
  const fameAnim = won && !!x.guildFame && !G.save.settings.reducedEffects && !famePlayed.has(x); // 길드 막대 차오름 (103)
  if (fameAnim) famePlayed.add(x);
  // 위 정보창은 로비 · 출전과 같은 모양 (설정 칸까지, 2026-10-13 Lim 「헤더 정렬」)
  st.el.innerHTML = `${topBar({ settings: true })}
    <div class="ns-body res">
      ${head(r, x, c.key, c.name)}
      ${tipHtml(r, x)}
      ${won ? lootHtml(r, x, anim, fameAnim) : loseHtml(r)}
      ${notesHtml(x)}
      ${recordHtml(r, !won)}
    </div>
    ${footHtml(r, x, tut)}`;
  resultModal.sync(null, []);
  if (anim) playRestBonus(st.el, x);
  if (fameAnim) playGuildFame(st.el, x);
  if (won && !voiced.has(x)) { voiced.add(x); resultSounds(x, anim, fameAnim); }
  // 심연의 심장을 처음 멈추면 엔딩 글 (59 4-4, 한 번만). 레벨업 팝업이 있으면 그 위에
  if (won && r.content === 'heart3' && x.first && !ended.has(x) && Object.values(G.save.clears.heart3 ?? {}).reduce((a, c) => a + (c?.n ?? 0), 0) === 1) {
    ended.add(x);
    setTimeout(() => { if (Flow.settle === x && !st.el.hidden) showEnding(st.el); }, 1600);
  }
  // 새로 열린 기능이 있으면 연출이 끝난 뒤 팝업 (한 판에 한 번)
  if (x.levelUps.length && !shown.has(x)) {
    shown.add(x);
    setTimeout(() => { if (Flow.settle === x && !st.el.hidden) showLevelUp(st.el, x.levelUps, r.hero ?? heroNow()); }, 1100);
  }
}
const shown = new WeakSet<object>(), ended = new WeakSet<object>(), restPlayed = new WeakSet<object>(), famePlayed = new WeakSet<object>(), voiced = new WeakSet<object>();

/**
 * 결과 소리 (107, 이 판 처음 그릴 때 한 번): 승리 가락 (전투가 끝날 때 냄) 위에 골드 (휴식 보너스 연출이 있으면 그 띠 소리가 대신) →
 * 가장 좋은 장비 카드 → 길드 결성 · 길드 Lv 업 (막대 연출이 있으면 그 연출이 냄)
 */
function resultSounds(x: Settlement, rest: boolean, fame: boolean): void {
  if (!rest && x.gold > 0) sfx('gold-gain', { delay: 0.35 });
  const rank = (it: Settlement['items'][number]) => ['loot', 'loot-rare', 'loot-legend'].indexOf(lootSound(it));
  const best = x.items.reduce<Settlement['items'][number] | null>((a, b) => (!a || rank(b) > rank(a) ? b : a), null);
  if (best) sfx(lootSound(best), { delay: 0.8 });
  const gf = x.guildFame;
  if (x.founded || (!fame && gf && guildLvOf(gf.before + gf.gain).lv > guildLvOf(gf.before).lv)) sfx('guild-levelup', { delay: 1.3 });
}

/**
 * 휴식 보너스 연출 (90 · 2026-10-17 Lim 「결과창에서 휴식보너스가 있으면 휴식 보너스가 적용되어 보너스라고 하면서 적용하자」):
 * 기본 값 (휴식 없을 때 값)이 먼저 뜨고, 0.3초 뒤 「휴식 보너스!」 띠와 함께 경험치 · 골드 숫자가 보너스만큼 올라감 (0.7초) → 「휴식 보너스 +N」.
 * 레벨 업 팝업 (1.1초) 전에 끝남. 띠는 1.8초에 사라짐. 시계는 setTimeout (화면 테스트의 page.clock으로 멈춤 · 진행)
 */
const REST_FX = { start: 300, count: 700, steps: 14, hide: 1800 };
function playRestBonus(root: HTMLElement, x: Settlement): void {
  const fx = root.querySelector<HTMLElement>('.r-restfx');
  if (!fx) return;
  const nums = Array.from(root.querySelectorAll<HTMLElement>('[data-rc-to]'));
  const live = () => Flow.settle === x && fx.isConnected;
  setTimeout(() => {
    if (!live()) return;
    fx.classList.add('on');
    sfx('rest-bonus');
    for (let i = 1; i <= REST_FX.steps; i++) {
      setTimeout(() => {
        if (!live()) return;
        const k = 1 - (1 - i / REST_FX.steps) ** 2;
        for (const el of nums) {
          const a = Number(el.dataset.rcFrom), b = Number(el.dataset.rcTo);
          el.textContent = fmt(i === REST_FX.steps ? b : Math.round(a + (b - a) * k));
        }
        if (i === REST_FX.steps) root.querySelectorAll('.r-rest-pend').forEach(e => e.classList.remove('r-rest-pend'));
      }, (REST_FX.count / REST_FX.steps) * i);
    }
  }, REST_FX.start);
  setTimeout(() => { if (live()) fx.classList.add('off'); }, REST_FX.hide);
}

/** 머리: 제목 · 장소·난이도·어픽스 · (이기면) 등급 + 별 칸 3개, (지면) 원인 */
function head(r: BattleResult, x: Settlement, key: ContentKey, name: string): string {
  const ch = x.chal, won = r.win && !r.quit;
  const kindName = t({ explore: '탐험', dungeon: '던전', raid: '레이드', event: '이벤트' }[contentOf(key).kind]);
  const title = r.quit ? t('포기') : !r.win ? t('전멸') : ch ? (ch.inTime ? t('{n}단계 돌파', { n: ch.stage }) : t('시간 초과')) : t('{k} 클리어!', { k: kindName });
  const afx = r.affixes?.length ? ` · ${r.affixes.map(k => tc(AFFIXES[k].name, 'affix')).join('·')}` : '';
  const sub = `${esc(t(name))} · ${ch ? t('주간 도전') : esc(t(r.diff))}${esc(afx)}${r.auto ? ` · ${t('자동 힐러')}` : ''}`;
  const badge = x.first ? `<em class="badge">${t('첫 클리어')}</em>` : x.best ? `<em class="badge">${t('최고 기록')}</em>` : '';
  let body: string;
  if (won) {
    // 별 칸: 위 ★, 아래 이번 판 값. 못 딴 별은 흐리게 + 기준
    const caps: [string, string][] = [
      [t('클리어 {t}', { t: mmss(r.time) }), ''],
      [t('쓰러짐 {n}', { n: r.deaths }), t('기준 {n}', { n: 0 })],
      [t('오버힐 {n}%', { n: x.overhealPct }), t('기준 {n}%↓', { n: Math.round(STAR_OVERHEAL * 100) })],
    ];
    const n = x.stars.filter(Boolean).length;
    body = `<div class="r-score"><b class="grade" aria-label="${t('등급 {g}', { g: String(x.grade) })}">${x.grade}</b>
      <ol class="r-stars" aria-label="${t('별 {n}개', { n })}">${x.stars.map((ok, i) => `<li class="${ok ? 'ok' : ''}"><i aria-hidden="true">★</i><small>${caps[i][0]}</small>${ok || !caps[i][1] ? '' : `<small class="need">${caps[i][1]}</small>`}</li>`).join('')}</ol></div>`;
  } else body = `<p class="r-why">${r.quit ? t('보상 없음') : esc(r.reason == null ? r.reason : t(r.reason))}</p>`;
  const hg = uiIcon('hourglass', 'in');
  const chal = !ch ? '' : ch.inTime ? `<p class="r-chal ok">${hg} ${mmss(ch.time)} / ${mmss(ch.limit)} · ${t('제한시간 안')}${ch.opened ? ` <em class="badge">${t('{n}단계 열림', { n: ch.stage + 1 })}</em>` : ''}${ch.best > ch.stage ? ` · ${t('이번 주 최고 {n}단계', { n: ch.best })}` : ''}</p>`
    : won ? `<p class="r-chal">${hg} ${mmss(ch.time)} / ${mmss(ch.limit)} · ${t('다음 단계는 안 열림')}</p>` : `<p class="r-chal">${t('실패 · 단계는 그대로')}</p>`;
  return `<header class="res-head ${won ? (ch && !ch.inTime ? 'win late' : 'win') : 'lose'}"${resArt(key)}>
      <h1>${title}${badge}</h1>
      <p>${sub}</p>
      ${body}
    </header>
    ${chal}`;
}

/**
 * 하루 첫 3판 (던전 · 레이드) 장비 확률 보너스 (13 2-2). 길드가 꺼져 있으면 모든 판이 공개모집이라 「오늘의 보너스」.
 * 어느 쪽이든 무엇이 오르는지 붙임 (2026-10-16 QA 「추천대로」: 「공개모집 보너스 1/3」은 뜻이 안 보였음, 길드를 켠 뒤에도 같게 2026-10-27)
 */
const pubBonusText = (n: number) => (FEATURES.guild ? t('공개모집 보너스 {n}/3 · 장비 확률 ↑', { n }) : t('오늘의 보너스 {n}/3 · 장비 확률 ↑', { n }));

/** 튜토리얼 안내 (09 4장 · 34 5-2): 녹슨 고원 클리어 = 끝 (첫 장비는 정산에서 바로 장착), 녹슨 요새 쉬움 첫 클리어 = 다음은 보통 */
function tipHtml(r: BattleResult, x: Settlement): string {
  const it = x.items[0], worn = !!it && G.save.gear.equipped[it.slot]?.id === it.id;
  // 튜토리얼 끝: 다음에 할 일 (로비 「출전」 = 길잡이가 고른 다음 장소)까지 (QA 2026-10-16, 처음 하는 사람이 다음을 몰랐음)
  if (x.tutEnd && worn) return `<p class="coachtip">${t('<b>첫 장비</b>를 바로 장착했습니다. 튜토리얼을 마쳤습니다. 로비의 <b>「출전」</b>을 누르면 다음 장소로 갑니다.')}</p>`;
  // 다음 장소 이름 · 레벨은 CONTENT를 따라감 (2026-10-18 해금 레벨 검토: Lv 3 탐험이 잿빛 공동묘지 → 고철 더미 언덕으로 바뀐 뒤에도 옛 이름이 남아 있었음)
  if (x.tutEnd && x.tutReplay) return `<p class="coachtip">${t('튜토리얼 다시 보기를 마쳤습니다. 로비의 <b>「출전」</b>을 누르면 지금 레벨에 맞는 곳으로 갑니다.')}</p>`; // 105 QA
  if (x.tutEnd) { const ex = contentOf('scrapheap'), dg = contentOf('rustfort'); return `<p class="coachtip">${t('튜토리얼을 마쳤습니다. Lv {a}에 탐험 <b>{x}</b>, Lv {b}에 첫 던전 <b>{d}</b>이 열립니다.', { a: ex.unlockLv, x: t(ex.name), b: dg.unlockLv, d: t(dg.name) })}</p>`; }
  // 「다음은 …」은 아래 「다음」 버튼 (nextRun, 길잡이의 길)과 같은 곳으로 (예전엔 녹슨 요새 보통으로 못 박아 버튼과 다른 곳을 가리켰음)
  if (r.content === 'rustfort' && x.first && r.diff === '쉬움' && !G.save.clears.rustfort?.['보통']) {
    const n = nextRun(r.content, r.diff), nc = n ? contentOf(n.content) : null;
    return `<p class="coachtip">${t('첫 던전을 클리어했습니다.')}${nc ? ` ${t('다음은 {name} <b>{d}</b>에 도전합니다.', { name: esc(t(nc.name)), d: t(n!.diff) })}` : ''}</p>`;
  }
  return '';
}

/** 받은 것: 장비 줄 (클리어마다 1개) · 재화 칸 · 경험치 줄. anim = 휴식 보너스 연출 (기본 값부터 올라감) */
function lootHtml(r: BattleResult, x: Settlement, anim = false, fameAnim = false): string {
  const tiles: string[] = [];
  // 재화는 한 줄 칩 (그림 · +값 · 이름, 2026-10-13 Lim 「골드 · 강화석 UI 점검」). 골드는 v16에 없앴다가 91에서 다시 (강화석 · 정제 강화석 대신)
  // 휴식 보너스 (90 · 2026-10-17 Lim): 받은 판은 골드 이름 옆 · 경험치 바 아래 남빛 「휴식 보너스 +N」 (받은 보너스 몫, 비례면 그만큼).
  // 연출이면 기본 값부터 올라가고 꼬리표는 다 오른 뒤 (playRestBonus). 휴식 없이 받은 판은 숫자만 (꼬리표 · 빨간 색 없음). 튜토리얼은 없음
  const gb = x.restBonus?.gold ?? 0;
  const tile = (k: CurrencyIconKey, label: string, v: number, add = 0) => `<span class="r-cur${add ? ' rb' : ''}"><span class="r-ci">${currencyIcon(k)}</span><span class="r-cv"><b>+${countUp(v, add, anim)}</b><small>${label}${add ? ` <i class="r-rest-tag${anim ? ' r-rest-pend' : ''}">${t('휴식 보너스 +{n}', { n: fmt(add) })}</i>` : ''}</small></span></span>`;
  if (x.gold) tiles.push(tile('gold', t('골드'), x.gold, gb));
  // 주간 도전 단계 보너스 (110): 받은 판만 머리 옆에 작게
  const bonus = r.chal && x.gold ? chalReward(r.chal) - 1 : 0;
  const tags = [x.pubBonus ? pubBonusText(x.pubBonus) : '', bonus > 0 ? t('{n}단계 +{p}%', { n: r.chal!, p: Math.round(bonus * 100) }) : ''].filter(Boolean);
  const fx = anim ? `<div class="r-restfx" aria-hidden="true"><span>${currencyIcon('rest')}<b>${t('휴식 보너스!')}</b></span></div>` : '';
  return `<section class="r-loot${x.items.length > 1 ? ' many' : ''}" aria-label="${t('받은 것')}">
      <h2 class="r-lh" tabindex="-1">${t('획득 보상')}${tags.length ? ` <small>${tags.join(' · ')}</small>` : ''}</h2>
      ${itemsHtml(x)}
      ${tiles.length ? `<div class="r-curs">${tiles.join('')}</div>` : ''}
      ${xpRow(x, anim)}
      ${guildRow(x, fameAnim)}
      ${fx}
    </section>`;
}

/** 숫자 v (휴식 보너스 add가 든 합계). 연출이면 기본 값 (v − add)부터 보이고 playRestBonus가 v까지 올림. <data>: 경험치 바의 span · i 규칙이 안 걸리게 */
function countUp(v: number, add: number, anim: boolean): string {
  return anim && add ? `<data value="${v}" data-rc-from="${v - add}" data-rc-to="${v}">${fmt(v - add)}</data>` : fmt(v);
}

/** 받은 장비를 누르면 캐릭터 메뉴와 같은 상세를 연다. 별도의 새 특수능력 띠는 표시하지 않는다. */
function itemsHtml(x: Settlement): string {
  // 레이드 칸 주 첫 보상 (2026-10-19 Lim 「주 첫 판만 크게」): 첫 클리어 = 레이드 보상, 다시 깬 판 = 던전과 같은 표 (월요일 오전 6시에 다시)
  const week = x.raidLoot === 'first' ? `<p class="r-item none week first">${t('이번 주 첫 클리어 보상')}</p>`
    : x.raidLoot === 'again' ? `<p class="r-item none week">${t('이번 주 첫 보상은 받음 · 월요일 오전 9시에 다시')}</p>` : '';
  // 장비가 안 나온 판 (탐험 판마다 EXPLORE_DROP, 103)은 아무 줄도 없음 (2026-10-24 Lim 「이번 판 장비 없음」 줄 뺌)
  return week + x.items.map(it => itemRow(it.id)).join('');
}

/** 장비 카드: 부위 그림(등급 색 테두리) · 이름 / 등급 칩 · 점수 · 부위·종류 / 특수능력 · 입고 있으면 「장착함」. 지금 장비와의 ▲▼ · 「빈칸」 비교는 없음 (2026-10-17 Lim 「전투 결과도 마찬가지」) */
function itemRow(id: number): string {
  const eq = G.save.gear.equipped;
  const it = G.save.gear.bag.find(b => b.id === id) || Object.values(eq).find(b => b?.id === id);
  if (!it) return '';
  const worn = eq[it.slot]?.id === it.id, sc = scoreOf(it);
  const act = worn ? `<span class="r-on">${t('장착함')}</span>` : '';
  // 특수능력 이름 (42)
  const sp = specKeysOf(it);
  const spTxt = sp.length ? `<small class="r-sp">${sp.map(k => esc(specName(k))).join(' · ')}</small>` : '';
  // 영웅 · 전설은 장비 칸 뒤로 등급 색 빛기둥 (36 4-6 fx-loot-beam, 흰 그림을 등급 색으로 칠함). 효과 줄이기면 움직이지 않음.
  // 품질 (91): 「정교한」 · 「완벽한」 희귀 이상도 같은 빛기둥 (이름 앞 작은 말)
  const q = qualityOf(it);
  const bu = it.grade === '영웅' || it.grade === '전설' || q ? art('fx-loot-beam') : '';
  const beam = bu ? `<span class="r-beam${G.save.settings.reducedEffects ? ' calm' : ''}" style="--beam:url('${bu}')" aria-hidden="true"></span>` : '';
  // 전설 (고유 장비 · 이름 있는 장신구, 88)은 빛기둥 위에 리본 · 별이 한 번 퍼짐 (50 E fx-unique-drop, 장비 칸 뒤). 효과 줄이기면 없음
  const drop = it.grade === '전설' && !G.save.settings.reducedEffects ? fxArt('fx-unique-drop', 'r-udrop') : '';
  return `<button type="button" class="r-item" data-reward-item="${id}" aria-haspopup="dialog" aria-label="${q ? `${t(q)} ` : ''}${esc(gearName(it))} ${t('상세 보기')}" style="--g:${GRADE_STYLE[it.grade].color};--gi:${GRADE_INK[it.grade]}">
      ${beam}${drop}<span class="r-ic${it.grade === '전설' ? ' lg' : ''}">${gearIcon(it)}</span>
      <span class="r-nm"><b>${q ? `<span class="r-q" data-q="${q}">${t(q)}</span> ` : ''}${esc(gearName(it))}</b><span class="r-gs"><i class="r-gr">${t(it.grade)}</i><span class="r-sc">${t('점수 {n}', { n: sc })}</span><small>${t(slotName(it.slot))} · ${esc(t(kindOf(it).name))}</small></span>${spTxt}</span>
      ${act}
    </button>`;
}

/** 경험치 줄: 바 + 받은 양 + 지금 레벨 (오르면 강조) */
/** anim = 휴식 보너스 연출 (90). 휴식 보너스 꼬리표는 바 아래 (바 안은 S25에서 잘림) */
function xpRow(x: Settlement, anim = false): string {
  const xb = x.restBonus?.xp ?? 0;
  const rest = xb ? `<small class="r-rest${anim ? ' r-rest-pend' : ''}">${t('휴식 보너스 +{n}', { n: fmt(xb) })}</small>` : '';
  const p = G.save.player, need = xpToNext(p.level), up = x.levelUps.length > 0;
  const w = isFinite(need) ? Math.min(100, (p.xp / need) * 100) : 100;
  // Lv 100 (더 오를 레벨 없음): 「경험치 +0 · 100%」 대신 「최대 레벨」 (위 정보창의 MAX와 같은 뜻, QA 2026-10-29)
  const top = !isFinite(need) && !up && !x.xp;
  return `<div class="r-xpw${up ? ' up' : ''}"><span class="r-lv" aria-hidden="true">${up ? `<small>Lv ${x.levelBefore} →</small>` : '<small>Lv</small>'}<b>${p.level}</b></span>
      <div class="r-xpc"><div class="xpbar r-xp${up ? ' up' : ''}" aria-label="${t('경험치 +{n}', { n: fmt(x.xp) })}${x.restBonus?.xp ? ` (${t('휴식 보너스 +{n}', { n: fmt(x.restBonus.xp) })})` : ''} · Lv ${p.level} · ${fmt(p.xp)} / ${isFinite(need) ? fmt(need) : t('최대')}"><i style="width:${w}%"></i><span>${top ? `<b>${t('최대 레벨')}</b><em>MAX</em>` : `<b>${t('경험치 +{n}', { n: countUp(x.xp, xb, anim) })}</b><em>${up ? t('레벨 업!') : `${Math.floor(w)}%`}</em>`}</span></div>${rest}</div></div>`;
}

/**
 * 길드 막대 (2026-10-19 Lim 「명성을 길드레벨의 경험치 개념으로 하여 ui도 경험치 바처럼」, 103): 길드파티로 명성을 얻은 판만, 내 경험치 막대 아래 같은 모양.
 * 「명성 +N」 · 이 레벨에서 쌓인 것 / 필요량, 레벨이 오르면 「길드 Lv 업!」 + 정원 +N. anim = 판 전 상태에서 차오름 (playGuildFame), 시각 효과 줄이기면 다 오른 모양
 */
function guildRow(x: Settlement, anim = false): string {
  const gf = x.guildFame;
  if (!gf) return x.guild?.low ? `<p class="r-item none r-glow">${t('낮은 장소 · 명성 없음')}</p>` : ''; // 적 레벨이 내 Lv − 10보다 낮은 길드파티 판 (103)
  const a = guildLvOf(gf.before), b = guildLvOf(gf.before + gf.gain), up = b.lv > a.lv;
  const pct = (l: ReturnType<typeof guildLvOf>) => (l.need ? Math.min(100, (l.have / l.need) * 100) : 100);
  const txt = (l: ReturnType<typeof guildLvOf>) => (l.need ? `${fmt(l.have)} / ${fmt(l.need)}` : 'MAX');
  const end = { lv: b.lv, w: pct(b), em: up ? t('길드 Lv 업!') : txt(b) };
  const start = anim ? { lv: a.lv, w: pct(a), em: txt(a) } : end, show = anim ? start : end;
  const label = `${t('명성 +{n}', { n: fmt(gf.gain) })} · ${t('길드 Lv {n}', { n: b.lv })} · ${b.need ? t('명성 {a} / {b}', { a: fmt(b.have), b: fmt(b.need) }) : t('최고 레벨')}${up ? ` · ${t('정원 +{n}', { n: b.cap - a.cap })}` : ''}`;
  return `<div class="r-xpw r-gxpw${up && !anim ? ' up' : ''}" data-gf-up="${up ? 1 : 0}" data-gf-lv="${b.lv}" data-gf-w="${end.w.toFixed(1)}" data-gf-em="${end.em}"${up ? ` data-gf-from="${a.lv}"` : ''}>
      <span class="r-lv r-glv" aria-hidden="true"><small>${up && !anim ? t('길드 {n} →', { n: a.lv }) : t('길드')}</small><b>${show.lv}</b></span>
      <div class="r-xpc"><div class="xpbar r-xp r-gxp${up && !anim ? ' up' : ''}" aria-label="${label}"><i style="width:${show.w.toFixed(1)}%"></i><span><b>${t('명성')} +<data value="${gf.gain}"${anim ? ` data-gf-to="${gf.gain}"` : ''}>${fmt(anim ? 0 : gf.gain)}</data></b><em>${show.em}</em></span></div>${up ? `<small class="r-gcap${anim ? ' r-rest-pend' : ''}">${t('정원 +{n}', { n: b.cap - a.cap })}</small>` : ''}</div></div>`;
}
const FAME_FX = { start: 350, count: 650, steps: 13 };
/** 길드 막대 차오름: 판 전 Lv · 막대에서 명성 +0 → +N, 레벨이 오르면 끝까지 찬 뒤 새 Lv · 「길드 Lv 업!」 · 정원 +N */
function playGuildFame(root: HTMLElement, x: Settlement): void {
  const row = root.querySelector<HTMLElement>('.r-gxpw');
  if (!row) return;
  const num = row.querySelector<HTMLElement>('[data-gf-to]'), bar = row.querySelector<HTMLElement>('.r-gxp i'), up = row.dataset.gfUp === '1';
  const live = () => Flow.settle === x && row.isConnected, to = Number(num?.dataset.gfTo ?? 0);
  setTimeout(() => {
    if (!live()) return;
    if (bar) bar.style.width = up ? '100%' : `${row.dataset.gfW}%`;
    for (let i = 1; i <= FAME_FX.steps; i++) setTimeout(() => { if (live() && num) num.textContent = fmt(Math.round((to * i) / FAME_FX.steps)); }, (FAME_FX.count / FAME_FX.steps) * i);
    setTimeout(() => {
      if (!live()) return;
      const em = row.querySelector<HTMLElement>('.r-gxp em'), lv = row.querySelector<HTMLElement>('.r-glv');
      if (em) em.textContent = row.dataset.gfEm ?? '';
      if (!up) return;
      row.classList.add('up'); row.querySelector('.r-gxp')?.classList.add('up');
      sfx('guild-levelup');
      if (lv) lv.innerHTML = `<small>${t('길드 {n} →', { n: row.dataset.gfFrom! })}</small><b>${row.dataset.gfLv}</b>`;
      if (bar) { bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition = ''; bar.style.width = `${row.dataset.gfW}%`; }
      row.querySelector('.r-gcap')?.classList.remove('r-rest-pend');
    }, FAME_FX.count + 120);
  }, FAME_FX.start);
}

/**
 * 진 판: 어디서 졌는지 (구간 점 · 적 남은 체력)만. 진 판은 경험치 없음 (2026-10-13 Lim).
 * 원인 줄 (해제 놓침 · 마나 바닥 · 장비가 권장보다 낮음)은 없다 (2026-10-23 Lim 「원인같은 항목 제거」). 다시 넣지 않는다
 */
function loseHtml(r: BattleResult): string {
  if (r.quit) return '';
  const names = r.segNames || [];
  // 구간 길: 점 (✓ 깸 · ✕ 여기서 짐) 아래 구간 이름
  const dots = r.segN > 1 ? `<ol class="r-segs" aria-hidden="true">${Array.from({ length: r.segN }, (_, i) => `<li class="${i < r.segIdx ? 'ok' : i === r.segIdx ? 'x' : ''}"><i>${i < r.segIdx ? '✓' : i === r.segIdx ? '✕' : i + 1}</i>${names[i] ? `<small>${esc(t(names[i]))}</small>` : ''}</li>`).join('')}</ol>` : '';
  const where = r.segN > 1 ? `${t('{n}구간', { n: r.segIdx + 1 })}${names[r.segIdx] ? ` ${esc(t(names[r.segIdx]))}` : ''}` : esc(t(names[0] || '보스'));
  const left = r.left ? ` · ${t('{who} 체력 <b>{p}%</b> 남음', { who: r.left.mobs ? t('적') : t('보스'), p: r.left.pct })}` : '';
  return `<section class="r-prog" aria-label="${t('진행')}">${dots}<p>${where}${left}</p></section>`;
}

/**
 * 길드원 한 사람 레벨 업 묶음 (2026-10-28 Lim 「파티원별로 묶어 잘리지 않게」): 직업 칸 · 이름 · Lv 이전 → 새 레벨 / 오른 능력치 칩 (줄바꿈, 자르지 않음) · 한 일.
 * 예전 한 줄 셋 (경험치 + 레벨 · 레벨업 두 배 · 능력치 둘)은 길어서 잘렸다.
 * 레벨업 두 배 (LV_DOUBLE)는 화면 어디에도 드러내지 않는다 (같은 날 Lim 「레벨업 두배 텍스트는 빼자. 사용자는 해당 시스템을 모르게」): 「레벨업 두 배」 글 · 두 배로 오른 칸 초록 테는 다시 넣지 않는다
 */
function guildUpHtml(m: NonNullable<Settlement['guild']>['members'][number]): string {
  const mem = G.save.guild.members.find(x => x.nick === m.nick);
  const from = m.ups[0] - 1, to = m.ups[m.ups.length - 1];
  const got = new Map<StatKey, { n: number; to: number }>();
  for (const s of m.stats) got.set(s.k, { n: (got.get(s.k)?.n ?? 0) + 1, to: s.shown ?? s.to });
  const why = m.stats.find(s => s.why)?.why;
  const chips = [...got].map(([k, v]) => `<span class="r-gm-st">${STAT_NAMES[k]} <b>${v.to}</b><small>+${v.n}</small></span>`).join('');
  const ic = mem ? `<span class="r-gm-ic" style="background:${ROLE[CLASSES[mem.cls].role].color}">${classIcon(mem.cls)}</span>` : '';
  return `<li>${ic}<div class="r-gm-b"><p class="r-gm-l1"><b class="r-gm-nick">${esc(nickOf(m.nick))}</b><span class="r-gm-lv">Lv ${from} → <b>${to}</b></span></p>${chips || why ? `<p class="r-gm-sts">${chips}${why ? `<small class="r-gm-why">${esc(why)}</small>` : ''}</p>` : ''}</div></li>`;
}

/**
 * 알림 줄: 길드원 · 부탁 · 원정 · 임무. 끝났다는 것만 알리고 누를 수 없다 (2026-10-24 Lim 「다른 곳으로 이동되지 않고 완료됐다는 것만 알려주자. 다른 것도」).
 * 「보상 받기」 · 「모집 공고로 영입」 같은 할 일 글 · › 화살표 · 눌러서 화면 이동은 다시 넣지 않는다
 */
function notesHtml(x: Settlement): string {
  const out: string[] = [];
  const gd = x.guild;
  // 길드 v2 (93 9-1): 결성 · 길드원 경험치 · 레벨 업 · 명성 · 첫 처치, 오른 능력치 (왜)
  // 업데이트 묶음 (93 8장): 부탁 쪽지 · 주간 원정
  if (x.jobs?.reqs.length) out.push(`<div class="r-note">${gameIcon('request', uiIcon('quest'))}<span>${t('부탁 완료')} · ${x.jobs.reqs.map(esc).join(' · ')} ${t('경험치 ×{n}', { n: REQ.xpMult })}</span></div>`);
  if (x.jobs?.exped.length) out.push(`<div class="r-note${x.jobs.expedAll ? ' hi' : ''}">${gameIcon('expedition-chest', uiIcon('star'))}<span>${t('주간 원정 {n}곳', { n: x.jobs.exped.length })} · ${t('명성 +{n}', { n: EXPED.fame * x.jobs.exped.length })}${x.jobs.expedAll ? ` · <b>${t('원정 상자 열림')}</b>` : ''}</span></div>`);
  if (x.founded) out.push(`<div class="r-note hi">${gameIcon('guild-flag', uiIcon('guild'))}<span><b>${t('길드 결성')}</b></span></div>`);
  if (gd?.first) out.push(`<div class="r-note hi">${gameIcon('guild-fame', uiIcon('star'))}<span><b>${t('길드 첫 처치')}</b></span></div>`);
  if (gd) {
    // 길드원 경험치 숫자 줄 (「길드원 경험치 +N」 · 「길드원 레벨 상한」)은 없다 (2026-10-28 Lim). 레벨이 오른 길드원만 한 사람에 한 묶음
    const rows = gd.members.filter(m => m.ups.length).map(guildUpHtml);
    if (rows.length) out.push(`<section class="r-note r-gm" aria-label="${t('길드원 레벨 업')}"><p class="r-gm-h">${gameIcon('guild-members', uiIcon('guild'))}<b>${t('길드원 레벨 업')}</b></p><ul>${rows.join('')}</ul></section>`);
    // 후원 (98): 쉬는 판에 출전만큼 받은 사람 (경험치 숫자 없이 남은 판만)
    if (gd.boosted.length) out.push(`<div class="r-note">${gameIcon('guild-sponsor', uiIcon('hands'))}<span>${t('후원')} · ${gd.boosted.slice(0, 2).map(b => `${esc(nickOf(b.nick))} ${t('{n}판 남음', { n: b.left })}`).join(' · ')}${gd.boosted.length > 2 ? ` ${t('외 {n}명', { n: gd.boosted.length - 2 })}` : ''}</span></div>`);
  }
  if (x.missions.length) out.push(`<div class="r-note">${gameIcon('mission', uiIcon('quest'))}<span>${t('임무 완료')} <b>${x.missions.length}</b></span></div>`);
  return out.length ? `<div class="r-notes">${out.join('')}</div>` : '';
}

/** 전투 기록 (접힘, 지면 펼침): 딜미터기 상위 5명 · 마지막 전투 · (개발 빌드) 플레이 기록. 지표 칩 · 「내 치유」 요약은 뺌 (2026-10-13 Lim) */
function recordHtml(r: BattleResult, open: boolean): string {
  const multi = r.segN > 1;
  const dev = G.save.settings.devUnlock && r.dev?.length
    ? `<details class="r-dev"><summary>${t('플레이 기록 (테스트용)')}</summary><dl class="metrics small">${r.dev.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></details>` : '';
  return `<details class="r-rec"${open ? ' open' : ''}>
      <summary>${t('전투 기록')}</summary>
      ${r.meter ? meterHtml(r.meter, r.time, { title: multi ? t('피해량 · 던전 전체') : t('피해량'), heal: r.healed, compact: true }) : ''}
      <dl class="metrics small">${r.detail.map(([k, v]) => `<div><dt>${esc(t(k))}</dt><dd>${esc(t(v))}</dd></div>`).join('')}</dl>
      ${dev}
    </details>`;
}

/**
 * 아래 버튼 (2026-10-13 Lim): [나가기 = 로비] [다시 도전] [다음 탐험 · 던전 · 레이드 (갈 곳 · 난이도)].
 * 다음 갈 곳은 game/next-run (탐험 · 던전은 길잡이의 길: 장소 Lv 1~9 쉬움 → 보통, 10~20 네 난이도 → 다음 장소, 기획 70 · 90). 주간 도전은 다음 단계가 열렸을 때 「n단계 도전」.
 * 지거나 갈 곳이 없으면 [나가기] [다시 도전]. 튜토리얼 중엔 로비 하나
 */
function footHtml(r: BattleResult, x: Settlement, tut: boolean): string {
  if (tut) return `<footer class="ns-foot"><button class="btn primary" type="button" data-go="s-lobby">${t('로비')}</button></footer>`;
  const nx = nextOf(r, x);
  const next = nx ? `<button class="btn primary r-next" type="button" id="next"><b>${nx.label}</b><small>${esc(nx.sub)}</small></button>` : '';
  return `<footer class="ns-foot ${nx ? 'row3' : 'row2'}">
      <button class="btn" type="button" data-go="s-lobby">${t('나가기')}</button>
      <button class="btn${nx ? '' : ' primary'}" type="button" id="again">${t('다시 도전')}</button>
      ${next}
    </footer>`;
}

/** 「다음」 버튼 글: 이긴 판만 */
function nextOf(r: BattleResult, x: Settlement): { label: string; sub: string } | null {
  if (!r.win || r.quit) return null;
  if (x.chal) return x.chal.opened ? { label: t('{n}단계 도전', { n: x.chal.stage + 1 }), sub: t('주간 도전') } : null;
  const n = nextRun(r.content, r.diff);
  if (!n) return null;
  const c = contentOf(n.content);
  return { label: t('다음 {k}', { k: t({ explore: '탐험', dungeon: '던전', raid: '레이드', event: '이벤트' }[c.kind]) }), sub: `${t(c.name)} · ${t(n.diff)}` };
}

/**
 * 전면 광고 (90): 클리어한 판의 결과 화면에서 나가는 버튼 (다음 · 다시 도전 · 나가기 · 위 정보창)을 누를 때,
 * 마지막 광고 뒤 화면에 떠 있던 시간이 10분을 넘었으면 한 번 띄우고, 닫히면 원래 누른 버튼대로 감.
 * Lv 10 전 · 튜토리얼 · 진 판 · 포기 · 광고 제거 패키지면 없음. 못 불러오면 그냥 감 (시계 그대로)
 */
let adPass = false;
st.el.addEventListener('click', e => {
  if (adPass) return;
  const b = (e.target as HTMLElement).closest<HTMLElement>('#again, #next, [data-go]');
  const r = Flow.result, x = Flow.settle;
  if (!b || !r || !x || interstitialOff()) return;
  const tutDone = G.save.tut >= TUT.done && !x.tutEnd;
  if (!interstitialDue({ won: r.win && !r.quit, level: G.save.player.level, tutDone, adsFree: adsFree(G.save), ms: adClockMs() })) return;
  e.preventDefault(); e.stopImmediatePropagation();
  void showInterstitial().then(() => {
    if (st.el.hidden || !b.isConnected) return;
    adPass = true;
    try { b.click(); } finally { adPass = false; }
  });
}, true);

st.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const reward = t.closest<HTMLElement>('[data-reward-item]');
  if (reward) showRewardItem(Number(reward.dataset.rewardItem));
  else if (t.closest('#again')) again();
  else if (t.closest('#next')) next();
  else if (t.closest('.m-all')) t.closest('.meter')?.classList.add('all');
});

function showRewardItem(id: number): void {
  if (itemDetailOpen || st.el.querySelector('.lvpop')) return;
  const settlement = Flow.settle;
  itemDetailOpen = openItemDetail(id, () => {
    if (st.el.hidden || Flow.settle !== settlement) return;
    itemDetailOpen = false;
    // 읽기 전용 상세를 닫으면 정산 화면과 스크롤을 그대로 두고 보상 카드로 포커스 복귀.
    (st.el.querySelector<HTMLElement>(`[data-reward-item="${id}"]`) ?? st.el.querySelector<HTMLElement>('.r-lh'))?.focus({ preventScroll: true });
    const queued = deferredPopups; deferredPopups = [];
    queued.forEach(show => show());
  });
}

/** 보상 상세를 읽는 동안 레벨 업/엔딩 타이머가 겹치지 않도록 닫은 뒤 이어서 표시한다. */
function deferPopup(host: HTMLElement, show: () => void): boolean {
  if (host !== st.el || !itemDetailOpen) return false;
  deferredPopups.push(show);
  return true;
}

/** 같은 파티로 바로 다시 (시작 위치는 새로, 주간 도전은 같은 단계). 입장 확인 팝업 없음 (90) */
function again(): void {
  Flow.seed = newSeed();
  depart();
}

/** 다음: 주간 도전은 다음 단계를 같은 파티로 바로, 그 밖엔 다음 장소 · 난이도의 편성 화면 (인원이 달라질 수 있어서) */
function next(): void {
  const r = Flow.result, x = Flow.settle;
  if (!r || !x) return;
  if (x.chal?.opened) { Flow.chal = x.chal.stage + 1; again(); return; }
  const n = nextRun(r.content, r.diff);
  if (!n) return;
  Flow.content = n.content; Flow.diff = n.diff; Flow.chal = 0;
  sortie(); // 편성으로 (90: 입장 확인 팝업 없음)
}

// ---------- 엔딩 글 (59 4-4 · 11 6장 햇살 축제) ----------
export function showEnding(host: HTMLElement): void {
  if (deferPopup(host, () => showEnding(host))) return;
  const box = document.createElement('div');
  box.className = 'overlay lvpop ending';
  box.innerHTML = `<div class="card" role="dialog" aria-label="${t('엔딩')}"><h3>${t('심장이 멈췄다')}</h3>${ENDING.map(line => `<p>${esc(t(line))}</p>`).join('')}
    <button class="btn primary" type="button">${t('햇살 축제로')}</button></div>`;
  box.querySelector('button')!.addEventListener('click', () => closeResultPopup(host));
  if (host === st.el) resultModal.beforeRender();
  host.appendChild(box);
  syncResultPopup(host);
}

// ---------- 레벨업 팝업 (P04) ----------
/** 새로 열린 기능이 있을 때만 띄움. 적이 내 레벨을 따라오므로 배율은 안 보여 줌 (32 5장) */
export function showLevelUp(host: HTMLElement, ups: number[], hero: HeroKey = heroNow()): void {
  const items = levelUpMilestones(ups, hero);
  if (!items.length) return;
  if (deferPopup(host, () => showLevelUp(host, ups, hero))) return;
  sfx('level-up');
  const icon = (text: string) => text.includes('특성') ? gameIcon('talent', uiIcon('star'))
    : /스킬|패시브|성언|쿨기/.test(text) ? gameIcon('skills', uiIcon('quest'))
    : /던전|탐험|레이드|도전/.test(text) ? gameIcon('a2-swords', uiIcon('weapon'))
    : /장비/.test(text) ? gameIcon('gear', uiIcon('weapon'))
    : /직업|퀘스트/.test(text) ? gameIcon('skills', uiIcon('quest'))
    : uiIcon('star');
  const box = document.createElement('div');
  box.className = `overlay lvpop r-level-pop${G.save.settings.reducedEffects ? ' calm' : ''}`;
  // A compact optical flash releases long, straight rays; each exits the viewport.
  // Uneven fixed spacing avoids a mechanical wheel and never consumes gameplay RNG.
  const rayAngles = [3, 18, 36, 57, 78, 96, 116, 138, 159, 184, 207, 228, 246, 263, 281, 304, 323, 344];
  const flights = G.save.settings.reducedEffects ? '' : `<i class="r-level-flash"></i>${rayAngles.map((angle, i) => {
    const length = 210 + i % 5 * 31;
    const thickness = 34 + i % 4 * 8;
    const delay = .44 + i % 5 * .012;
    const life = .65 + i % 3 * .03;
    return `<i class="r-level-ray" style="--angle:${angle}deg;--length:${length}px;--thickness:${thickness}px;--alpha:${i % 3 === 0 ? 1 : .82};--delay:${delay.toFixed(3)}s;--life:${life.toFixed(3)}s"></i>`;
  }).join('')}`;
  box.innerHTML = `<div class="card r-level-card" role="dialog" aria-modal="true" aria-labelledby="levelUpTitle">
    <div class="r-level-hero">
      <div class="r-level-banner" aria-hidden="true"></div>
      <div class="r-level-flightfield" aria-hidden="true">${flights}</div>
      <div class="r-level-heading"><h3 id="levelUpTitle">${t('레벨 업!')}</h3></div>
      <p class="lvnum" aria-label="${t('Lv {a}에서 {b}로 레벨 업', { a: ups[0] - 1, b: ups[ups.length - 1] })}"><span class="r-level-number"><span>Lv</span><b>${ups[ups.length - 1]}</b></span></p>
    </div>
    <h4 class="r-level-unlock-title">${t('새로 열린 기능')}</h4>
    <ul class="r-level-unlocks" aria-label="${t('새로 열린 기능')}">${items.map(m => `<li><span class="r-level-unlock-icon" aria-hidden="true">${icon(m.text)}</span><b>${esc(milestoneText(m))}</b><small>Lv ${m.lv}</small></li>`).join('')}</ul>
    <button class="btn primary r-level-confirm" type="button">${t('확인')}</button></div>`;
  box.querySelector('button')!.addEventListener('click', () => closeResultPopup(host));
  if (host === st.el) resultModal.beforeRender();
  host.appendChild(box);
  syncResultPopup(host);
}

/** 레벨 업 위에 엔딩이 겹쳐도 맨 위 팝업만 닫고 이전 팝업으로 포커스를 돌린다. */
function closeResultPopup(host: HTMLElement): void {
  if (host === st.el) resultModal.beforeRender();
  host.querySelectorAll('.lvpop')[host.querySelectorAll('.lvpop').length - 1]?.remove();
  syncResultPopup(host);
}
function syncResultPopup(host: HTMLElement): void {
  const popups = Array.from(host.querySelectorAll<HTMLElement>('.lvpop'));
  popups.forEach((popup, i) => { popup.style.zIndex = String(70 + i); });
  if (host === st.el) resultModal.sync(popups.at(-1)?.querySelector<HTMLElement>('.card') ?? null, popups.map(p => p.classList.contains('ending') ? 'ending' : 'level'));
  else popups.at(-1)?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
}
