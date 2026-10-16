/**
 * S02 로비 = 살아 있는 마을 + A2 목재·리넨 UI (2026-10-11 채택 시안). 캐릭터 그림 없음.
 * 위 정보창(공통 topBar) 아래 ~ 하단 탭 위의 마을 장면(village.ts)은 그대로 유지하고 UI만 겹친다:
 *  왼쪽 원형 소켓 = 임무 (받을 것 있으면 노란 「!」 = 한 번에 받기) · 주간 도전 · 일일 상자,
 *  오른쪽 황동 패널 = 첨탑 (10인 레이드) · 길드 회관 (길드를 빼 두면 없음) · 잡화점. 「다시」 소켓은 뺐다 (Lim 2026-10-12, 지난 판은 「출전」이 이어 감),
 *  아래 리넨 목표표 + 붉은 「출전」은 바깥 하단을 맞추며, 로비 패스 바로가기는 두지 않는다.
 * 받기·열기는 그 자리에서. 튜토리얼 중엔 다음 목표 + 출전 + 안내만.
 */
import { contentOf, RAID10_LV, stageOf, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { ITEM_GRADES, recommendedFor, SLOTS, type ItemGrade } from '../data/equipment';
import { CHAL } from '../data/challenge';
import { STAMINA_COST } from '../data/economy';
import { FEATURES } from '../data/features';
import { guildCap } from '../data/guild';
import { nextMilestone } from '../data/milestones';
import { weekRemaining } from '../game/clock';
import { chestState, claimChalChest, claimChest, claimMission, missionReady } from '../game/economy';
import { Flow } from '../game/flow';
import { guide } from '../game/guide';
import { capOf, guildOpen } from '../game/guild';
import { chalGate } from '../game/runmode';
import { commit, firstDungeonNow, G, lockOf, refreshDay } from '../game/state';
import { TUT } from '../game/tutorial';
import { esc, screen, topBar } from './kit';
import { art } from '../art';
import { gameIcon, uiIcon } from './art';
import { sortie } from './stamina';
import { gainText } from './shop';
import { mountVillage } from './village';

/** A2에서 생성한 작은 황동 화살표. 문자를 도형 대신 사용하지 않는다. */
const chevron = () => `<img class="lb-chevron" src="${art('a2-chevron')}" alt="" aria-hidden="true" decoding="async" draggable="false">`;

const st = { msg: '' };

/**
 * 목표 한 줄. title = 큰 제목 (장소 이름 · Lv n), tag = 난이도 표, sub = 설명, prog = 진행 n/m,
 * to = 누르면 그 콘텐츠의 편성 화면
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
  { lv: 70, from: 55, name: '가라앉은 대성당', grade: '영웅' },
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

/** 다음 목표 칸: 첫 목표 = 큰 제목 + 난이도 표 + 진행, 둘째 목표 = 흐린 한 줄. 누르면 첫 목적지 편성 화면 */
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
/** 출전: 입장 확인 → 스테미너를 내고 편성으로 (81) */
function toParty(to: { content: ContentKey; diff: DiffName }): void {
  Flow.content = to.content; Flow.diff = to.diff; Flow.chal = 0;
  sortie();
}

/** 원형 소켓 바로가기: 전투 스킬 칸과 같은 spell-socket 안에 그림, 아래 이름 + 짧은 상태 */
function socket(cls: string, attrs: string, icon: string, name: string, sub: string, extra = ''): string {
  return `<div class="lb-sc ${cls}"><button type="button" class="lb-main"${attrs}><span class="lb-sock">${icon}</span><span class="lb-caption"><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>${extra}</div>`;
}

/** 왼쪽 소켓: 임무 · 주간 도전 · 일일 상자 */
function shortcuts(): string {
  const s = G.save, d = s.daily, w = s.weekly;
  // 임무: 받을 것이 있으면 소켓 위 노란 「!」 (= 한 번에 받기) + 빨간 숫자. 소켓은 임무 화면
  const dGot = d.missions.filter(m => m.got).length, wGot = w.missions.filter(m => m.got).length;
  const ready = d.missions.filter(missionReady).length + w.missions.filter(missionReady).length;
  const mLine = `일일 ${dGot}/${d.missions.length}${w.missions.length ? ` · 주간 ${wGot}/${w.missions.length}` : ''}`;
  const missions = socket(`lb-missions${ready ? ' hot' : ''}`, ` data-go="s-missions" aria-label="임무 · ${mLine}${ready ? ` · 받을 보상 ${ready}` : ''}"`,
    gameIcon('mission', uiIcon('quest')), '임무', `일일 ${dGot}/${d.missions.length}`,
    ready ? `<i class="g-badge" aria-hidden="true">${ready}</i><button type="button" class="lb-claim" id="lbClaim" aria-label="임무 보상 ${ready}개 받기"><span class="g-qm" aria-hidden="true">!</span></button>` : '');
  // 주간 도전: 이번 주 남은 날 (잠기면 해금 레벨). 도전 상자가 있으면 소켓 = 받기
  const cg = chalGate(s), left = weekRemaining();
  const chalIcon = gameIcon('challenge', uiIcon('hourglass'));
  const chal = s.chalChest
    ? socket('lb-chal hot', ' id="lbChal" aria-label="주간 도전 상자 받기"', chalIcon, '주간 도전', '상자 받기', '<i class="g-badge" aria-hidden="true">!</i>')
    : socket(`lb-chal${cg.ok ? '' : ' off'}`, ` data-go="s-content" data-arg="dungeon" aria-label="주간 도전 · ${esc(CHAL.name)} · ${cg.ok ? `${left} 남음` : `Lv ${cg.lv}에 열림`}"`,
      chalIcon, '주간 도전', cg.ok ? `${left} 남음` : `Lv ${cg.lv}`);
  // 일일 상자: 열 수 있으면 소켓 = 열기 (쌓인 날이 있으면 개수). 닫혀 있으면 여는 조건 진행 (임무 n/5 받음) 또는 「내일 다시」
  const ch = chestState(s), open = ch.today || ch.banked > 0, n = (ch.today ? 1 : 0) + ch.banked;
  const chestIcon = gameIcon('chest', uiIcon('chest'));
  const chest = open
    ? socket('lb-chest hot', ` id="lbChest" aria-label="일일 상자 열기${n > 1 ? ` · ${n}개` : ''}"`, chestIcon, '일일 상자', n > 1 ? `열기 ×${n}` : '열기', '<i class="g-badge" aria-hidden="true">!</i>')
    : socket('lb-chest off', ' data-go="s-missions"', chestIcon, '일일 상자', d.chest ? '내일 다시' : `임무 ${dGot}/${d.missions.length}`);
  return `<nav class="lb-side lb-left" aria-label="마을 바로가기">${missions}${chal}${chest}</nav>`;
}

/** 오른쪽 황동 패널: 첨탑 = 10인 레이드, 길드 회관 (길드를 빼 두면 없음), 잡화점 */
function buildings(): string {
  const s = G.save;
  const raid = contentOf('abyss1'), raidLock = lockOf(raid).locked;
  const plate = (cls: string, attrs: string, icon: string, name: string, sub: string, extra = '') =>
    `<button type="button" class="lb-plate ${cls}"${attrs} aria-label="${esc(name)} · ${esc(sub)}">${icon}<span class="lb-pt"><b>${name}</b><span>${sub.split(' · ').map(line => `<span>${line}</span>`).join('')}</span></span>${chevron()}${extra}</button>`;
  const gOpen = guildOpen(s), apps = (s.guild.post?.cands.length || 0) + s.guild.scouts.length;
  const gLine = !gOpen.ok ? gOpen.why : apps ? `지원자 ${apps}명` : `길드원 ${s.guild.members.length}/${capOf(s).cap}`;
  const plates = plate(`lb-raid${raidLock ? ' lock' : ''}`, ' data-go="s-content" data-arg="raid10"', gameIcon('raid', uiIcon('star')), '첨탑',
    raidLock ? `10인 레이드 · Lv ${raid.unlockLv}에 열림` : `10인 레이드 · 스테미너 ${STAMINA_COST.raid10}`)
    + (FEATURES.guild ? plate(`lb-guild${gOpen.ok ? '' : ' lock'}`, ' data-go="s-guild"', gameIcon('guild', uiIcon('guild'), 'tab'), '길드 회관', esc(gLine), gOpen.ok && apps ? `<i class="g-badge">${apps}</i>` : '') : '')
    + plate('lb-shop', ' data-go="s-shop" data-arg="cash"', gameIcon('shop', uiIcon('shop'), 'tab'), '잡화점', '상품 · 공훈');
  return `<div class="lb-side lb-right">${plates}</div>`;
}

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
          <div class="lb-mid">${tutDone ? shortcuts() + buildings() : ''}</div>
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
  if (t.closest('#lobbyStart')) { toParty(dest()); return; }
  const gr = t.closest<HTMLElement>('[data-goal]');
  if (gr) { const g = goals()[Number(gr.dataset.goal)]; if (g?.to) toParty(g.to); return; }
  if (t.closest('#lbClaim')) {
    // 받을 수 있는 임무를 한 번에 (주간은 악몽 열쇠가 가득이면 남김)
    const got: string[] = [];
    for (const kind of ['daily', 'weekly'] as const) (kind === 'daily' ? save.daily : save.weekly).missions.forEach((m, i) => {
      if (!missionReady(m)) return;
      const r = claimMission(save, kind, i, now);
      got.push(typeof r === 'string' ? r : gainText(r));
    });
    st.msg = got.length ? `임무 보상: ${got.join(' · ')}` : '';
    commit(); render(); return;
  }
  if (t.closest('#lbChest')) { const r = claimChest(save, Math.random, now); st.msg = typeof r === 'string' ? r : `일일 상자: ${gainText(r)}`; commit(); render(); return; }
  if (t.closest('#lbChal')) { const r = claimChalChest(save, Math.random, now); st.msg = typeof r === 'string' ? r : `주간 도전 상자: ${gainText(r)}`; commit(); render(); }
});
