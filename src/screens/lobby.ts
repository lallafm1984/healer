/**
 * S02 로비 = 살아 있는 마을 + A2 목재·리넨 UI (2026-10-11 채택 시안). 캐릭터 그림 없음.
 * 위 정보창(공통 topBar) 아래 ~ 하단 탭 위의 마을 장면(village.ts)은 그대로 유지하고 UI만 겹친다:
 *  메뉴 = 2026-10-16 Lim A안 「마을 표지판」 (그날까지의 기획 반영: 휴식 보너스 90, 레이드 10 · 20인, 상점 상품 81, 장비 정리 · 재설정):
 *  왼쪽 원형 소켓 = 오늘 할 일: 임무 (일일 상자를 합침, 받을 것 있으면 노란 「!」 = 임무 보상 + 상자 한 번에) · 주간 도전 · 휴식 충전 (모자랄 때만),
 *  오른쪽 나무 팻말 = 마을 건물: 레이드 (예전 첨탑) · 길드 회관 (길드를 빼 두면 없음) · 대장간 · 잡화점. 「다시」 소켓은 뺐다 (Lim 2026-10-12, 지난 판은 「출전」이 이어 감),
 *  아래 리넨 목표표 + 붉은 「출전」(모험 길잡이 추천 칸)은 바깥 하단을 맞추며, 로비 패스 바로가기는 두지 않는다.
 * 받기·열기는 그 자리에서. 튜토리얼 중엔 다음 목표 + 출전 + 안내만.
 */
import { contentOf, RAID10_LV, stageOf, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { ITEM_GRADES, recommendedFor, SLOTS, type ItemGrade } from '../data/equipment';
import { CHAL } from '../data/challenge';
import { jobProductId, REST_BONUS, STAMINA, STAMINA_COST } from '../data/economy';
import { HERO_KEYS, HEROES } from '../data/heroes';
import { adventureTabOf } from '../data/adventure-regions';
import { FEATURES } from '../data/features';
import { guildCap } from '../data/guild';
import { nextMilestone } from '../data/milestones';
import { weekRemaining } from '../game/clock';
import { chestState, claimChalChest, claimChest, claimMission, missionReady } from '../game/economy';
import { guide } from '../game/guide';
import { chalGate } from '../game/runmode';
import { commit, firstDungeonNow, G, lockOf, newGearCount, refreshDay } from '../game/state';
import { adsFree, staminaView } from '../game/stamina';
import { TUT } from '../game/tutorial';
import { esc, go, screen, topBar } from './kit';
import { art } from '../art';
import { currencyIcon, gameIcon, uiIcon } from './art';
import { gainText } from './shop';
import { passReady } from './tabs';
import { mountVillage } from './village';

/** A2에서 생성한 작은 황동 화살표. 문자를 도형 대신 사용하지 않는다. */
const chevron = () => `<img class="lb-chevron" src="${art('a2-chevron')}" alt="" aria-hidden="true" decoding="async" draggable="false">`;

const st = { msg: '' };

/**
 * 목표 한 줄. title = 큰 제목 (장소 이름 · Lv n), tag = 난이도 표, sub = 설명, prog = 진행 n/m,
 * to = 누르면 그 장소 · 난이도가 골라진 모험 선택 화면
 */
interface Goal { title: string; tag?: DiffName; sub: string; prog: string; to?: { content: ContentKey; diff: DiffName } }
/** 목표 한 줄 글 (aria · 두 번째 줄) */
const goalText = (g: Goal) => `${g.title}${g.tag ? ` · ${g.tag}` : ''}${g.sub && !g.tag ? ` · ${g.sub}` : ''}`;
/** 좁은 리넨 표에는 스킬·장소 이름만, 접근성 설명에는 분류를 포함한 원래 목표 정보를 유지한다. */
const shortGoalText = (g: Goal) => goalText(g).replace(/(?:스킬|탐험|던전|레이드)\s*「([^」]+)」/g, '$1');
/** 두 번째 줄은 「 · 」 사이에서만 줄을 바꾼다 (장소 이름 「역병 약초 / 온실」처럼 이름 중간에서 끊기지 않게) */
const shortGoalHtml = (g: Goal) => shortGoalText(g).split(' · ').map((part, i, all) => `<span class="nb">${esc(part)}${i < all.length - 1 ? ' ·' : ''}</span>`).join(' ');

/** 다음 목표 줄: 모험 길잡이 추천 (86: 지금 레벨 · 장비에 맞는 탐험 · 던전 한 칸) → 다음 레벨 마일스톤 (이 빌드에 있는 것) */
function goals(): Goal[] {
  const out: Goal[] = [];
  const lvNow = G.save.player.level;
  // 처음 깨는 칸이면 「클리어 0/1」, 다시 도는 칸이면 「추천 Lv n」(적 레벨)
  const g = guide();
  if (g) {
    const c = contentOf(g.content), first = !G.save.clears[c.key]?.[g.diff];
    out.push({ title: c.name, tag: g.diff, sub: first ? '클리어' : '추천', prog: first ? '0/1' : `Lv ${stageOf(c, g.diff)}`, to: g });
  }
  let lv = lvNow;
  for (let i = 0; i < 20; i++) {
    const m = nextMilestone(lv, G.save.hero);
    if (!m) break;
    const live = m.items.filter(x => x.live);
    // 괄호 설명은 빼고 첫 항목만 (목표 칸이 좁음)
    if (live.length) { out.push({ title: `Lv ${m.level}`, sub: live[0].text.replace(/\s*\(.*\)\s*$/, ''), prog: `${lvNow}/${m.level}` }); break; }
    lv = m.level;
  }
  return out.slice(0, 2);
}

/** 권장 장비 (편성 화면 경고와 같은 값) — 목표 aria 설명용 */
const recLabel = (to: { content: ContentKey; diff: DiffName }) => { const r = recommendedFor(contentOf(to.content), to.diff); return r ? ` · 권장 ${r.label}` : ''; };

/** 목표 칸 머리: A2 펼친 책 그림 + 「다음 목표」 */
const trkHead = () => `<span class="trk-h">${gameIcon('a2-goal-book-r6', uiIcon('quest'))}<span>다음 목표</span></span>`;

/**
 * 레이드 문 (18 3-3): 레벨이 가까워지면 남은 조건을 체크 목록으로. 길드원 수는 그 전 레벨에서 둘 수 있는 최대 (6명·12명), 길드를 빼 두면 그 줄 없음.
 * 권장 파티 전투력 줄은 17 9-3 식이 정해지면 추가
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
  const need = guildCap(g.lv - 1).cap, have = G.save.guild.members.length;
  const gi = ITEM_GRADES.indexOf(g.grade);
  const gear = SLOTS.filter(sl => { const it = G.save.gear.equipped[sl.key]; return it && ITEM_GRADES.indexOf(it.grade) >= gi; }).length;
  const rows: [boolean, string, string, string][] = [
    [lv >= g.lv, `레벨 ${g.lv}`, `${lv} / ${g.lv}`, ''],
    ...(FEATURES.guild ? [[have >= need, `길드원 ${need}명`, `${have} / ${need}`, 's-guild'] as [boolean, string, string, string]] : []),
    [gear >= SLOTS.length, `장비 ${g.grade} 이상`, `${gear} / ${SLOTS.length} 부위`, 's-char'],
  ];
  const to = rows.find(r => !r[0] && r[3])?.[3];
  const inner = `${trkHead()}<span class="trk-tl"><strong class="trk-t">${g.name}</strong><small>Lv ${g.lv}</small></span>
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
    ? `<strong class="trk-t">${esc(first.title)}</strong>
      <span class="trk-lv">${first.tag ? `<span class="trk-diff">${esc(first.tag)}</span>` : ''}<span class="trk-sub">${esc(first.sub)}</span><small>${first.prog}</small></span>`
    : '<strong class="trk-t">마을 정비</strong>';
  const inner = `${trkHead()}${main}${rest.map(g => `<span class="obj dim" aria-label="${esc(goalText(g))} · ${g.prog}"><i></i><span>${shortGoalHtml(g)}</span><small>${g.prog}</small></span>`).join('')}`;
  return to >= 0
    ? `<button type="button" class="lb-trk" data-goal="${to}" aria-label="다음 목표: ${gs.map(g => `${esc(goalText(g))} · ${g.prog}`).join(', ')}${recLabel(gs[to].to!)}">${inner}</button>`
    : `<div class="lb-trk">${inner}</div>`;
}

/**
 * 「출전」 목적지: 첫 던전 차례면 녹슨 요새 쉬움 → 모험 길잡이 추천 (86, 2026-10-16 Lim 「각 컨텐츠를 찾아가면서 깨야 하는 불친절함」.
 * 예전엔 지난 판 그대로 → 레벨이 올라도 같은 곳을 가리켰음) → 지난 판 → 녹슨 요새
 */
function dest(): { content: ContentKey; diff: DiffName } {
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
/** 출전 · 다음 목표: 그 장소 · 난이도를 골라 둔 모험 선택 화면으로 (2026-10-17 Lim 「바로 시작이 아닌 해당 화면으로」). 그 화면 「출전」 → 입장 확인 → 편성 (81 · 90) */
function toAdventure(to: { content: ContentKey; diff: DiffName }): void {
  go('s-content', to);
}

/** 원형 소켓 바로가기: 전투 스킬 칸과 같은 spell-socket 안에 그림, 아래 이름 + 짧은 상태 */
function socket(cls: string, attrs: string, icon: string, name: string, sub: string, extra = ''): string {
  return `<div class="lb-sc ${cls}"><button type="button" class="lb-main"${attrs}><span class="lb-sock">${icon}</span><span class="lb-caption"><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>${extra}</div>`;
}
/** 나무 팻말 버튼: 그림 + 이름 + 상태 두 줄 */
const plate = (cls: string, attrs: string, icon: string, name: string, lines: string[], extra = '') =>
  `<button type="button" class="lb-plate ${cls}"${attrs} aria-label="${esc(name)} · ${esc(lines.join(' · '))}">${icon}<span class="lb-pt"><b>${name}</b><span>${lines.map(line => `<span>${line}</span>`).join('')}</span></span>${chevron()}${extra}</button>`;

/** 오늘 받을 것: 임무 (일일 · 주간) + 일일 상자 (임무 5개를 다 받으면, 놓친 날 2일까지) */
function today() {
  const s = G.save, d = s.daily, w = s.weekly, ch = chestState(s);
  const dGot = d.missions.filter(m => m.got).length, wGot = w.missions.filter(m => m.got).length;
  const ready = d.missions.filter(missionReady).length + w.missions.filter(missionReady).length;
  const chests = (ch.today ? 1 : 0) + ch.banked;
  const line = `일일 ${dGot}/${d.missions.length}${w.missions.length ? ` · 주간 ${wGot}/${w.missions.length}` : ''}`;
  return { d, dGot, ready, chests, line, done: d.chest };
}

/** 임무 소켓 (일일 상자를 합침): 받을 것이 있으면 노란 「!」 = 임무 보상 + 상자를 한 번에 */
function missionSock(): string {
  const t = today(), n = t.ready + t.chests;
  const sub = !t.ready && t.chests ? '상자 열기' : `일일 ${t.dGot}/${t.d.missions.length}`;
  return socket(`lb-missions${n ? ' hot' : ''}`, ` data-go="s-missions" aria-label="임무 · ${t.line}${t.chests ? ' · 일일 상자' : ''}${n ? ` · 받을 것 ${n}` : ''}"`,
    gameIcon('mission', uiIcon('quest')), '임무', sub,
    n ? `<i class="g-badge" aria-hidden="true">${n}</i><button type="button" class="lb-claim" id="lbClaim" aria-label="임무 보상 · 일일 상자 ${n}개 받기"><span class="g-qm" aria-hidden="true">!</span></button>` : '');
}
/** 주간 도전: 이번 주 남은 날 (잠기면 해금 레벨). 도전 상자가 있으면 소켓 = 받기 */
function chalSock(): string {
  const s = G.save, cg = chalGate(s), left = weekRemaining();
  const icon = gameIcon('challenge', uiIcon('hourglass'));
  return s.chalChest
    ? socket('lb-chal hot', ' id="lbChal" aria-label="주간 도전 상자 받기"', icon, '주간 도전', '상자 받기', '<i class="g-badge" aria-hidden="true">!</i>')
    : socket(`lb-chal${cg.ok ? '' : ' off'}`, ` data-go="s-content" data-arg="dungeon" aria-label="주간 도전 · ${esc(CHAL.name)} · ${cg.ok ? `${left} 남음` : `Lv ${cg.lv}에 열림`}"`,
      icon, '주간 도전', cg.ok ? `${left} 남음` : `Lv ${cg.lv}`);
}
/**
 * 레이드 (예전 「첨탑」, 10인 Lv 45 · 20인 Lv 70): 열림은 실제 레벨로 적음 (개발 빌드 「레벨 잠금 무시」여도),
 * 둘째 줄 = 이번 주 받은 레이드 장비 수 (보스 × 난이도마다 주 1회). 휴식은 입장 비용이 아니라 적지 않는다 (90).
 * 누르면 지난 판이 레이드면 그 인원 탭, 아니면 열린 것 중 큰 레이드 탭
 */
function raidPlate(): string {
  const s = G.save, lv = s.player.level, r10 = contentOf('abyss1'), r20 = contentOf('cathedral1');
  const open = lv >= r10.unlockLv, both = lv >= r20.unlockLv, got = s.weekly.loot.length;
  const last = s.last && contentOf(s.last.content as ContentKey);
  const tab = last?.kind === 'raid' ? adventureTabOf(last) : both ? 'raid20' : 'raid10';
  return plate(`lb-raid${open ? '' : ' lock'}`, ` data-go="s-content" data-arg="${tab}"`, gameIcon(both ? 'raid20' : 'raid', uiIcon('star')), '레이드',
    [both ? '10인 · 20인' : '10인 레이드', !open ? `Lv ${r10.unlockLv}에 열림` : got ? `주간 장비 ${got}` : '주 1회 장비']);
}

/**
 * 대장간 (2026-10-16 새로): 필요 없는 장비 정리 (분해 → 장비 개편 뒤 판매 · 골드) · 옵션 재설정. 빨간 숫자 = 가방의 새 장비.
 * 지금은 캐릭터 › 장비로 감. 장비 개편 작업이 판매 · 재설정 화면을 따로 열면 그 화면으로 바꾼다
 */
function forgePlate(): string {
  const n = newGearCount();
  return plate('lb-forge', ' data-go="s-char" data-arg="gear"', gameIcon('forge', uiIcon('char')), '대장간', ['장비 정리', '옵션 재설정'], n ? `<i class="g-badge" aria-label="새 장비 ${n}">${n}</i>` : '');
}

/**
 * 잡화점 = 상점 상품 탭: 광고 제거 · 새 직업 (공훈은 나중 콘텐츠, 시즌 패스는 상점 안에만).
 * 2026-10-18부터 상점은 하단 탭이 아니라 여기서 들어감 (Lim 「상점의 진입 루트는 로비」) → 받을 시즌 패스 단계는 빨간 숫자 (상점 안 패스 탭에도 점)
 */
function shopPlate(): string {
  const s = G.save, noads = adsFree(s), jobs = HERO_KEYS.filter(h => HEROES[h].unlock.buy && !s.bought.includes(jobProductId(h))).length;
  const lines = [noads ? '' : '광고 제거', jobs ? `새 직업 ${jobs}` : '', !noads || jobs ? '' : '시즌 패스'].filter(Boolean);
  const pass = passReady();
  return plate('lb-shop', ' data-go="s-shop" data-arg="cash"', gameIcon('shop', uiIcon('shop'), 'tab'), '잡화점', lines,
    pass ? `<i class="g-badge" aria-label="받을 시즌 패스 보상 ${pass}">${pass}</i>` : '');
}

/**
 * 휴식 충전: 휴식이 던전 한 판 몫 (10) 밑이고 충전할 수 있을 때만 왼쪽 맨 아래에 나옴 (다른 소켓 자리는 그대로).
 * 0이면 휴식 보너스 (클리어 경험치 · 골드 × REST_BONUS)를 못 받아 빛남. 누르면 휴식 창 (광고 +30 하루 3번, 광고 제거면 바로)
 */
function restSock(): string {
  const v = staminaView(G.save, Date.now());
  if (v.unlimited || v.n >= STAMINA_COST.dungeon || !v.adsLeft) return '';
  return socket(`lb-rest${v.n < 1 ? ' hot' : ''}`, ` data-stamina-open aria-label="휴식 충전 · 휴식 ${v.n}/${v.max} · 휴식이 있으면 보너스 ×${REST_BONUS}"`, currencyIcon('rest'), '휴식 충전',
    `${adsFree(G.save) ? '바로' : '광고'} +${STAMINA.ad}`, v.n < 1 ? '<i class="g-badge" aria-hidden="true">!</i>' : '');
}

/** 왼쪽 = 오늘 할 일 소켓 (임무 · 주간 도전 · 휴식이 모자랄 때 휴식 충전), 오른쪽 = 마을 건물 팻말 (레이드 · 대장간 · 잡화점). 길드는 하단 탭 (2026-10-18) */
const menus = () => `<nav class="lb-side lb-left" aria-label="오늘 할 일">${missionSock()}${chalSock()}${restSock()}</nav>
  <nav class="lb-side lb-right" aria-label="마을 건물">${raidPlate()}${forgePlate()}${shopPlate()}</nav>`;

/** 아래 독립된 목표표 + 「출전」 (지난 판 → 안 깬 장소). 시즌 패스는 상점에만 둔다. */
function journey(): string {
  const to = dest(), c = contentOf(to.content);
  const cta = `<button type="button" class="lb-cta${firstDungeonNow() ? ' hi-pulse' : ''}" id="lobbyStart" aria-label="출전 · ${esc(c.name)} ${esc(to.diff)}">${gameIcon('a2-swords', gameIcon('battle', uiIcon('battle'), 'tab'))}<span class="lb-cta-copy"><b>출전</b><small>${esc(c.name)} · ${esc(to.diff)}</small></span>${chevron()}</button>`;
  return `<div class="lb-journey">${tracker()}<div class="lb-go">${cta}</div></div>`;
}

const s = screen('s-lobby', '로비', {
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
          ${firstDungeonNow() ? '<p class="coachtip lb-coach">첫 던전 <b>녹슨 요새</b>가 열림. 「출전」 누르기</p>' : ''}
          ${journey()}
        </div>
        ${st.msg ? `<p class="warnbox lb-msg" role="status">${esc(st.msg)}</p>` : ''}
      </div>
    </div>`;
  // 설정 「시각 효과 줄이기」: 메뉴의 빛 쓸기 · 숨쉬기 · 배지 통통도 멈춤 (lobby-life.css)
  s.el.classList.toggle('calm', !!G.save.settings.reducedEffects);
  // 살아 있는 마을: 같은 캔버스를 새 무대로 옮겨 붙여 움직임이 이어짐 (보상 받기로 다시 그려도)
  mountVillage(s.el.querySelector('.lb-stage'));
  st.msg = '';
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement, save = G.save, now = Date.now();
  if (t.closest('#lobbyStart')) { toAdventure(dest()); return; }
  const gr = t.closest<HTMLElement>('[data-goal]');
  if (gr) { const g = goals()[Number(gr.dataset.goal)]; if (g?.to) toAdventure(g.to); return; }
  if (t.closest('#lbClaim')) {
    // 받을 수 있는 임무를 한 번에
    const got: string[] = [];
    for (const kind of ['daily', 'weekly'] as const) (kind === 'daily' ? save.daily : save.weekly).missions.forEach((m, i) => {
      if (!missionReady(m)) return;
      const r = claimMission(save, kind, i, now);
      got.push(typeof r === 'string' ? r : gainText(r));
    });
    // 이어서 일일 상자 (임무 5개를 다 받으면 열림 · 놓친 날 쌓인 것, 최대 2일)도 같이. 광고로 한 번 더는 임무 화면에서
    for (let i = 0; i < 3; i++) {
      const ch = chestState(save);
      if (!ch.today && !ch.banked) break;
      const r = claimChest(save, Math.random, now);
      got.push(typeof r === 'string' ? r : `상자 ${gainText(r)}`);
    }
    st.msg = got.length ? `받음: ${got.join(' · ')}` : '';
    commit(); render(); return;
  }
  if (t.closest('#lbChal')) { const r = claimChalChest(save, Math.random, now); st.msg = typeof r === 'string' ? r : `주간 도전 상자: ${gainText(r)}`; commit(); render(); }
});
