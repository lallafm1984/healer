/**
 * S02 로비 = 살아 있는 마을 + A2 목재·리넨 UI (2026-10-11 채택 시안). 캐릭터 그림 없음.
 * 위 정보창(공통 topBar) 아래 ~ 하단 탭 위의 마을 장면(village.ts)은 그대로 유지하고 UI만 겹친다:
 *  메뉴 = 2026-10-16 Lim A안 「마을 표지판」 (그날까지의 기획 반영: 휴식 보너스 90, 레이드 10 · 20인, 상점 상품 81, 장비 정리 · 판매):
 *  왼쪽 원형 소켓 = 오늘 할 일: 임무 (일일 상자를 합침, 받을 것 있으면 빨간 숫자) · 주간 도전 · 휴식 충전 (모자랄 때만),
 *  오른쪽 원형 문장 = 마을 건물: 상점 · 행상인 (2026-10-22 Lim 시안 1). 레이드 · 대장간 팻말은 2026-10-21 Lim 「로비 화면에서 우측에 레이드, 대장간 제거, 잡화점은 상점으로」로 뺐다
 *  (레이드는 전투 탭, 장비 정리 · 판매는 캐릭터 탭). 「다시」 소켓은 뺐다 (Lim 2026-10-12, 지난 판은 「출전」이 이어 감),
 *  아래 리넨 목표표 + 붉은 「출전」(모험 길잡이 추천 칸)은 바깥 하단을 맞추며.
 * 받기·열기는 그 자리에서. 튜토리얼 중엔 다음 목표 + 출전 + 안내만.
 */
import { contentOf, RAID10_LV, stageOf, type ContentKey } from '../data/content';
import { t, tc } from '../i18n';
import type { DiffName } from '../data/difficulty';
import { ITEM_GRADES, recommendedFor, SLOTS, type ItemGrade } from '../data/equipment';
import { CHAL } from '../data/challenge';
import { REST_BONUS, STAMINA_COST } from '../data/economy';
import { FEATURES } from '../data/features';
import { guildPartyNeed, guildSeatCount } from '../game/guild';
import { nextMilestone } from '../data/milestones';
import { weekRemaining } from '../game/clock';
import { chestState, claimChalChest, missionReady } from '../game/economy';
import { Flow } from '../game/flow';
import { guide } from '../game/guide';
import { merchantOffer } from '../game/merchant';
import { chalContent, chalGate } from '../game/runmode';
import { commit, firstDungeonNow, G, lockOf, refreshDay } from '../game/state';
import { adsFree, staminaView } from '../game/stamina';
import { TUT } from '../game/tutorial';
import { esc, go, screen, topBar, milestoneText } from './kit';
import { art } from '../art';
import { currencyIcon, gameIcon, uiIcon } from './art';
import { showReward } from './reward-pop';
import { noticeModal } from '../platform/ads';
import { sfx } from '../sfx';
import { mountVillage } from './village';
import { ENCOUNTERS } from '../data/encounters';
import { now as gameNow } from '../platform/time';

/** A2에서 생성한 작은 황동 화살표. 문자를 도형 대신 사용하지 않는다. */
const chevron = () => `<img class="lb-chevron" src="${art('a2-chevron')}" alt="" aria-hidden="true" decoding="async" draggable="false">`;


/**
 * 목표 한 줄. title = 큰 제목 (장소 이름 · Lv n), tag = 난이도 표, sub = 설명, prog = 진행 n/m,
 * to = 누르면 그 장소 · 난이도가 골라진 모험 선택 화면
 */
interface Goal { title: string; tag?: DiffName; sub: string; prog: string; to?: { content: ContentKey; diff: DiffName } }
/** 목표 한 줄 글 (aria · 두 번째 줄) */
const goalText = (g: Goal) => `${t(g.title)}${g.tag ? ` · ${t(g.tag)}` : ''}${g.sub && !g.tag ? ` · ${g.sub}` : ''}`; // 장소 · 난이도는 보여 줄 때 번역 (한국어는 그대로)
/** 좁은 리넨 표에는 스킬·장소 이름만, 접근성 설명에는 분류를 포함한 원래 목표 정보를 유지한다. */
const shortGoalText = (g: Goal) => goalText(g).replace(/(?:스킬|탐험|던전|레이드)\s*「([^」]+)」/g, '$1');
/** 두 번째 줄은 「 · 」 사이에서만 줄을 바꾼다 (장소 이름 「역병 약초 / 온실」처럼 이름 중간에서 끊기지 않게) */
// 둘째 목표 한 줄: 「Lv 33」을 굵게 앞에 두고 점 없이 띄움. 좁은 폰에서 두 줄로 꺾이면 「Lv 33 ·」 끝에 점이 매달렸음 (UI 검수 2026-10-20)
const shortGoalHtml = (g: Goal) => shortGoalText(g).split(' · ').map((part, i) => (i ? `<span class="nb">${esc(part)}</span>` : `<b class="nb">${esc(part)}</b>`)).join(' ');

/** 다음 목표 줄: 모험 길잡이 추천 (86: 지금 레벨 · 장비에 맞는 탐험 · 던전 한 칸) → 다음 레벨 마일스톤 (이 빌드에 있는 것) */
function goals(): Goal[] {
  const out: Goal[] = [];
  const lvNow = G.save.player.level;
  // 처음 깨는 칸이면 「클리어 0/1」, 다시 도는 칸이면 「추천 Lv n」(적 레벨)
  // 첫 던전 차례엔 출전(dest) · 안내문과 같은 녹슨 요새 쉬움 (길잡이는 탐험 보통을 먼저 꼽아 카드와 버튼이 다른 곳을 가리켰음)
  const g = G.save.tut < TUT.done ? { content: 'plateau' as ContentKey, diff: '쉬움' as DiffName }
    : firstDungeonNow() ? { content: 'rustfort' as ContentKey, diff: '쉬움' as DiffName } : guide(); // 튜토리얼 중엔 튜토리얼 탐험 (105 QA)
  if (g) {
    const c = contentOf(g.content), first = !G.save.clears[c.key]?.[g.diff];
    out.push({ title: c.name, tag: g.diff, sub: first ? t('클리어') : t('추천'), prog: first ? '0/1' : `Lv ${stageOf(c, g.diff)}`, to: g });
  }
  let lv = lvNow;
  for (let i = 0; i < 20; i++) {
    const m = nextMilestone(lv, G.save.hero);
    if (!m) break;
    const live = m.items.filter(x => x.live);
    // 괄호 설명은 빼고 첫 항목만 (목표 칸이 좁음)
    if (live.length) { out.push({ title: `Lv ${m.level}`, sub: milestoneText(live[0]).replace(/\s*\(.*\)\s*$/, ''), prog: `${lvNow}/${m.level}` }); break; }
    lv = m.level;
  }
  return out.slice(0, 2);
}

/** 권장 장비 (편성 화면 경고와 같은 값) — 목표 aria 설명용 */
const recLabel = (to: { content: ContentKey; diff: DiffName }) => { const r = recommendedFor(contentOf(to.content), to.diff); return r ? ` · ${t('권장 {n}', { n: r.label })}` : ''; };

/** 목표 칸 머리: A2 펼친 책 그림 + 「다음 목표」 */
const trkHead = () => `<span class="trk-h">${gameIcon('a2-goal-book-r6', uiIcon('quest'))}<span>${t('다음 목표')}</span></span>`;

/**
 * 레이드 문 (18 3-3): 레벨이 가까워지면 남은 조건을 체크 목록으로. 길드원 수는 그 레이드를 길드원만으로 다 채우는 인원 (10인 9 · 20인 19명, guildPartyNeed, 2026-10-28 길드파티는 길드원만), 길드를 빼 두면 그 줄 없음.
 * (권장 파티 전투력 줄은 없음: 전투력 숫자는 길드 v2에서 없앰)
 */
const GATES: { lv: number; from: number; name: string; grade: ItemGrade }[] = [
  { lv: RAID10_LV, from: RAID10_LV - 10, name: '심연의 탑', grade: '희귀' }, // 10인 열림은 레벨표를 따라감 (69)
  { lv: 70, from: 55, name: '가라앉은 대성당', grade: '희귀' }, // 88: 영웅은 Lv 45부터 드물게라 20인 문도 희귀 6부위 (밸런스 기준 악몽 희귀 +5)
];
/** 레이드 문 시기면 목표 칸 = 체크 목록. 누르면 아직 안 된 첫 줄의 화면 (길드·캐릭터) */
function gateTracker(): string {
  const lv = G.save.player.level;
  const g = GATES.find(x => lv >= x.from && lv < x.lv);
  if (!g || G.save.tut < TUT.done) return '';
  // 레이드 길드파티 인원 (10인 9 · 20인 19명), 길드원은 역할 자리로 셈 (105 QA 2: 탱커 3 + 딜러 7도 「10명 ✓」였음)
  const enc = ENCOUNTERS[contentOf(g.lv >= 70 ? 'cathedral1' : 'abyss1').fights('보통')[0]], need = guildPartyNeed(g.lv >= 70 ? 20 : 10), have = guildSeatCount(G.save, enc);
  const gi = ITEM_GRADES.indexOf(g.grade);
  const gear = SLOTS.filter(sl => { const it = G.save.gear.equipped[sl.key]; return it && ITEM_GRADES.indexOf(it.grade) >= gi; }).length;
  const rows: [boolean, string, string, string][] = [
    [lv >= g.lv, t('레벨 {n}', { n: g.lv }), `${lv} / ${g.lv}`, ''],
    ...(FEATURES.guild ? [[have >= need, t('길드원 {n}명', { n: need }), `${have} / ${need}`, 's-guild'] as [boolean, string, string, string]] : []),
    [gear >= SLOTS.length, t('장비 {g} 이상', { g: t(g.grade) }), t('{a} / {b} 부위', { a: gear, b: SLOTS.length }), 's-char'],
  ];
  const to = rows.find(r => !r[0] && r[3])?.[3];
  const inner = `${trkHead()}<span class="trk-tl"><strong class="trk-t">${t(g.name)}</strong><small>Lv ${g.lv}</small></span>
    ${rows.map(([ok, k, v]) => `<span class="obj${ok ? ' ok' : ''}"><i></i><span>${k}</span><small>${v}</small></span>`).join('')}`;
  return to
    ? `<button type="button" class="lb-trk gate" data-go="${to}"${to === 's-char' ? ' data-arg="gear"' : ''}>${inner}</button>`
    : `<div class="lb-trk gate">${inner}</div>`;
}

/** 다음 목표 칸: 첫 목표 = 큰 제목 + 난이도 표 + 진행, 둘째 목표 = 흐린 한 줄. 누르면 첫 목적지가 골라진 모험 선택 화면 */
function tracker(): string {
  const gate = gateTracker();
  if (gate) return gate;
  const gs = goals(), to = gs.findIndex(g => g.to);
  const [first, ...rest] = gs;
  const main = first
    ? `<strong class="trk-t">${esc(t(first.title))}</strong>
      <span class="trk-lv">${first.tag ? `<span class="trk-diff">${esc(t(first.tag))}</span>` : ''}<span class="trk-sub">${esc(first.sub)}</span><small>${first.prog}</small></span>`
    : `<strong class="trk-t">${t('마을 정비')}</strong>`;
  const inner = `${trkHead()}${main}${rest.map(g => `<span class="obj dim" aria-label="${esc(goalText(g))} · ${g.prog}"><i></i><span>${shortGoalHtml(g)}</span><small>${g.prog}</small></span>`).join('')}`;
  return to >= 0
    ? `<button type="button" class="lb-trk" data-goal="${to}" aria-label="${t('다음 목표')}: ${gs.map(g => `${esc(goalText(g))} · ${g.prog}`).join(', ')}${recLabel(gs[to].to!)}">${inner}</button>`
    : `<div class="lb-trk">${inner}</div>`;
}

/**
 * 「출전」 목적지: 첫 던전 차례면 녹슨 요새 쉬움 → 모험 길잡이 추천 (86, 2026-10-16 Lim 「각 컨텐츠를 찾아가면서 깨야 하는 불친절함」.
 * 예전엔 지난 판 그대로 → 레벨이 올라도 같은 곳을 가리켰음) → 지난 판 → 녹슨 요새
 */
function dest(): { content: ContentKey; diff: DiffName } {
  if (G.save.tut < TUT.done) return { content: 'plateau', diff: '쉬움' }; // 튜토리얼 중 (다시 보기에서 지거나 포기한 뒤 포함)엔 튜토리얼 탐험 (105 QA: 고레벨 판을 가리키는데 출전은 꺼져 있었음)
  if (firstDungeonNow()) return { content: 'rustfort', diff: '쉬움' };
  const g = guide();
  if (g) return g;
  const last = G.save.last;
  if (last) {
    const c = contentOf(last.content as ContentKey);
    if (c && c.ready && !lockOf(c, last.diff).locked) return { content: c.key, diff: last.diff };
  }
  return { content: 'rustfort', diff: '쉬움' };
}
/** 출전 · 다음 목표: 그 장소 · 난이도를 골라 둔 모험 선택 화면으로 (2026-10-17 Lim 「바로 시작이 아닌 해당 화면으로」). 그 화면 「출전」 → 편성 (입장 확인 팝업은 2026-10-17 없앰) */
function toAdventure(to: { content: ContentKey; diff: DiffName }): void {
  go('s-content', to);
}

/** 원형 소켓 바로가기: 전투 스킬 칸과 같은 spell-socket 안에 그림, 아래 이름 + 짧은 상태 */
function socket(cls: string, attrs: string, icon: string, name: string, sub: string, extra = ''): string {
  return `<div class="lb-sc ${cls}"><button type="button" class="lb-main"${attrs}><span class="lb-sock">${icon}</span><span class="lb-caption"><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>${extra}</div>`;
}
/** 원형 문장 + 짙은 목재 명패 (2026-10-22 Lim 시안 1). 이름은 실제 UI 글자로 유지한다. */
const commerceEmblem = (cls: string, attrs: string, image: string, name: string) =>
  `<button type="button" class="lb-plate lb-emblem ${cls}"${attrs} aria-label="${esc(name)}"><img class="lb-emblem-art" src="${art(image)}" alt="" aria-hidden="true" decoding="async" draggable="false"><span class="lb-pt"><b>${name}</b></span></button>`;

/** 오늘 받을 것: 임무 (일일 · 주간) + 일일 상자 (임무 5개를 다 받으면, 놓친 날 2일까지) */
function today() {
  const s = G.save, d = s.daily, w = s.weekly, ch = chestState(s);
  const dGot = d.missions.filter(m => m.got).length, wGot = w.missions.filter(m => m.got).length;
  const ready = d.missions.filter(missionReady).length + w.missions.filter(missionReady).length;
  const chests = (ch.today ? 1 : 0) + ch.banked;
  const line = `${t('일일 {a}/{b}', { a: dGot, b: d.missions.length })}${w.missions.length ? ` · ${t('주간 {a}/{b}', { a: wGot, b: w.missions.length })}` : ''}`;
  return { d, dGot, ready, chests, line, done: d.chest };
}

/**
 * 임무 소켓 (일일 상자를 합침): 받을 것이 있으면 빨간 숫자 (임무 보상 + 상자), 받기는 임무 화면에서.
 * 옆의 노란 「!」 (한 번에 받기)는 2026-10-24 Lim 「느낌표제거」로 뺐다
 */
function missionSock(): string {
  const td = today(), n = td.ready + td.chests;
  const sub = !td.ready && td.chests ? t('상자 열기') : t('일일 {a}/{b}', { a: td.dGot, b: td.d.missions.length });
  return socket(`lb-missions${n ? ' hot' : ''}`, ` data-go="s-missions" aria-label="${t('임무')} · ${td.line}${td.chests ? ` · ${t('일일 상자')}` : ''}${n ? ` · ${t('받을 것 {n}', { n })}` : ''}"`,
    gameIcon('mission', uiIcon('quest')), t('임무'), sub,
    n ? `<i class="g-badge" aria-hidden="true">${n}</i>` : '');
}
/**
 * 주간 도전: 이번 주 남은 날. 도전 상자가 있으면 소켓 = 받기.
 * 레벨이 모자라 잠겼으면 소켓을 두지 않는다 (2026-10-24 Lim 「레벨 제한으로 잠긴 팻말은 로비에서 숨기기」, 예전 어두운 소켓 + 「Lv 20」 → 전투 탭)
 */
function chalSock(): string {
  const s = G.save, cg = chalGate(s), icon = gameIcon('challenge', uiIcon('hourglass'));
  if (s.chalChest) return socket('lb-chal hot', ` id="lbChal" aria-label="${t('주간 도전 상자 받기')}"`, icon, tc('주간 도전', 'short'), t('상자 받기'), '<i class="g-badge" aria-hidden="true">!</i>');
  if (!cg.ok) return '';
  // 바로 주간 도전 화면 (2026-10-22 Lim 「주간 도전 선택시 바로 주간도전 화면으로 이동」)
  const left = weekRemaining();
  return socket('lb-chal', ` data-chal-go aria-label="${t('주간 도전')} · ${esc(t(CHAL.name))} · ${t('{n} 남음', { n: left })}"`, icon, tc('주간 도전', 'short'), t('{n} 남음', { n: left }));
}
/**
 * 상점 (예전 「잡화점」, 2026-10-21 Lim 「잡화점은 상점으로」): 상품 한 쪽. 이름만 (가운데, lobby-menu.css).
 * 「새 직업 N」 줄은 2026-10-21 Lim 「새직업, 골드로사기 텍스트 제거하고 가운데 맞춤으로 정렬」, 「광고 제거」 · 「상품」 줄은 2026-10-22 Lim 「상점 메뉴에서 "광고제거" 텍스트 제거」로 뺐다.
 * 2026-10-18부터 상점은 하단 탭이 아니라 여기서 들어감 (Lim 「상점의 진입 루트는 로비」). 시즌 패스 (예전 빨간 숫자) · 공훈은 2026-10-20 Lim이 없앰
 */
function shopPlate(): string {
  return commerceEmblem('lb-shop', ' data-go="s-shop" data-arg="cash"', 'lobby-shop-emblem-v1', t('상점'));
}

/**
 * 행상인 (떠돌이 상인, 106, 2026-10-20 Lim 「디아블로2 갬블 요소처럼 … 골드소비처」): 부위를 골라 골드로 사는 미확인 장비 (종류 무작위).
 * 이름만 (「미확인 장비」 줄은 2026-10-22 Lim 「행상인 메뉴에서 "미확인 장비" 제거」로 뺌).
 * Lv 10 (MERCHANT.lv) 전엔 팻말을 두지 않는다 (2026-10-24 Lim 「레벨 제한으로 잠긴 팻말은 로비에서 숨기기」, 예전 어두운 팻말 + 「Lv 10부터」)
 */
function merchantPlate(): string {
  return merchantOffer(G.save).open ? commerceEmblem('lb-merchant', ' data-go="s-merchant"', 'lobby-merchant-emblem-v1', t('행상인')) : '';
}

/**
 * 휴식 충전: 휴식이 던전 한 판 몫 (20) 밑이고 충전할 수 있을 때만 왼쪽 맨 아래에 나옴 (다른 소켓 자리는 그대로).
 * 0이면 휴식 보너스 (클리어 경험치 · 골드 × REST_BONUS)를 못 받아 빛남. 누르면 휴식 창 (최대 충전 하루 3번, 광고 제거면 바로)
 */
function restSock(): string {
  const v = staminaView(G.save, gameNow());
  if (v.unlimited || v.n >= STAMINA_COST.dungeon || !v.adsLeft) return '';
  return socket(`lb-rest${v.n < 1 ? ' hot' : ''}`, ` data-stamina-open aria-label="${t('휴식 충전')} · ${t('휴식 {a}/{b}', { a: v.n, b: v.max })} · ${t('휴식이 있으면 보너스 ×{n}', { n: REST_BONUS })}"`, currencyIcon('rest'), tc('휴식 충전', 'short'),
    adsFree(G.save) ? t('바로 최대 충전') : tc('광고 최대 충전', 'short'), v.n < 1 ? '<i class="g-badge" aria-hidden="true">!</i>' : '');
}

/**
 * 왼쪽 = 오늘 할 일 소켓 (임무 · 주간 도전 · 휴식이 모자랄 때 휴식 충전), 오른쪽 = 마을 건물 팻말 (상점 · 행상인, 2026-10-21). 길드는 하단 탭 (2026-10-18).
 * 잠긴 주간 도전 · 행상인은 빠지고 남은 것이 위에서부터 붙는다 (빈 칸을 두지 않음)
 */
const menus = () => `<nav class="lb-side lb-left" aria-label="${t('오늘 할 일')}">${missionSock()}${chalSock()}${restSock()}</nav>
  <nav class="lb-side lb-right" aria-label="${t('마을 건물')}">${shopPlate()}${merchantPlate()}</nav>`;

/** 아래 독립된 목표표 + 「출전」 (지난 판 → 안 깬 장소). */
function journey(): string {
  const to = dest(), c = contentOf(to.content);
  const cta = `<button type="button" class="lb-cta${firstDungeonNow() ? ' hi-pulse' : ''}" id="lobbyStart" aria-label="${t('출전')} · ${esc(t(c.name))} ${esc(t(to.diff))}">${gameIcon('a2-swords', gameIcon('battle', uiIcon('battle'), 'tab'))}<span class="lb-cta-copy"><b>${t('출전')}</b><small>${esc(t(c.name))} · ${esc(t(to.diff))}</small></span>${chevron()}</button>`;
  return `<div class="lb-journey">${tracker()}<div class="lb-go">${cta}</div></div>`;
}

const s = screen('s-lobby', t('로비'), {
  tab: 'lobby',
  enter() { refreshDay(); render(); },
});

function render(): void {
  const tutDone = G.save.tut >= TUT.done;
  s.el.innerHTML = `${topBar({ settings: true })}
    <div class="ns-body lb30${tutDone ? '' : ' tut'}">
      <div class="lb-world">
        <div class="lb-stage"></div>
        <div class="lb-ui">
          <div class="lb-mid">${tutDone ? menus() : ''}</div>
          ${firstDungeonNow() ? `<p class="coachtip lb-coach">${t('첫 던전 {name}가 열렸습니다. 「출전」을 눌러 시작합니다.', { name: `<b>${t('녹슨 요새')}</b>` })}</p>` : ''}
          ${journey()}
        </div>
      </div>
    </div>`;
  // 설정 「시각 효과 줄이기」: 메뉴의 빛 쓸기 · 숨쉬기 · 배지 통통도 멈춤 (lobby-life.css)
  s.el.classList.toggle('calm', !!G.save.settings.reducedEffects);
  // 살아 있는 마을: 같은 캔버스를 새 무대로 옮겨 붙여 움직임이 이어짐 (보상 받기로 다시 그려도)
  mountVillage(s.el.querySelector('.lb-stage'));
}

s.el.addEventListener('click', e => {
  const el = e.target as HTMLElement, save = G.save;
  if (el.closest('#lobbyStart')) { toAdventure(dest()); return; }
  const gr = el.closest<HTMLElement>('[data-goal]');
  if (gr) { const g = goals()[Number(gr.dataset.goal)]; if (g?.to) toAdventure(g.to); return; }
  if (el.closest('[data-chal-go]')) {
    // 주간 도전 바로 가기: 전투 탭 도전 카드와 같은 길 (content.ts [data-chal])
    Flow.content = chalContent(save); Flow.diff = CHAL.diff; Flow.chal = save.chalOpen;
    go('s-entry'); return;
  }
  if (el.closest('#lbChal')) {
    // 임무 화면 「열기」와 같게: 상자 걸쇠 소리 + 보상 창 (reward-pop, 2026-10-24 Lim 시안 A), 못 받으면 까닭 알림 창
    const r = claimChalChest(save, Math.random);
    sfx(typeof r === 'string' ? 'deny' : 'chest-open');
    commit(); render();
    if (typeof r === 'string') void noticeModal(t('주간 도전 상자'), esc(r));
    else showReward({ title: t('주간 도전 상자'), gold: r.gold, items: r.items });
  }
});
