/**
 * S02 로비 = 마을 (30 0장 → 2026-10-11 전투 Sunforged 기준 코덱스 로비 시안). 캐릭터 그림 없음.
 * 위 정보창(공통 topBar) 아래 ~ 하단 탭 위가 살아 있는 마을 장면 (village.ts). 그 위에 전투 부품으로 만든 메뉴:
 *  왼쪽 원형 소켓 = 임무 (받을 것 있으면 노란 「!」 = 한 번에 받기) · 주간 도전 · 일일 상자,
 *  오른쪽 황동 패널 = 첨탑 (10인 레이드) · 길드 회관 (길드를 빼 두면 없음) · 잡화점, 그 아래 원형 소켓 = 「다시」 (지난 판),
 *  아래 황동·가죽 패널 = 다음 목표 (레이드 문 앞이면 체크 목록) + 「출전」 + 시즌 패스.
 * 받기·열기는 그 자리에서. 튜토리얼 중엔 다음 목표 + 출전 + 안내만.
 */
import { CONTENT, contentOf, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { ITEM_GRADES, RECOMMENDED, SLOTS, type ItemGrade } from '../data/equipment';
import { CHAL } from '../data/challenge';
import { PASS_LEVELS, SHARD_MAX } from '../data/economy';
import { FEATURES } from '../data/features';
import { guildCap } from '../data/guild';
import { nextMilestone } from '../data/progression';
import { weekRemaining } from '../game/clock';
import { chestState, claimChalChest, claimChest, claimMission, missionReady, passLevel } from '../game/economy';
import { Flow } from '../game/flow';
import { capOf, guildOpen } from '../game/guild';
import { chalGate } from '../game/runmode';
import { commit, firstDungeonNow, G, lockOf, refreshDay } from '../game/state';
import { TUT } from '../game/tutorial';
import { esc, go, screen, topBar } from './kit';
import { gameIcon, uiIcon } from './art';
import { gainText } from './shop';
import { mountVillage } from './village';

// 소켓 선 아이콘 (icon-replay · icon-pass 그림이 없을 때)
const REPLAY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>';
const PASS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/></svg>';

const st = { msg: '' };

/**
 * 목표 한 줄. title = 큰 제목 (장소 이름 · Lv n), tag = 난이도 표, sub = 설명, prog = 진행 n/m,
 * to = 누르면 그 콘텐츠의 편성 화면
 */
interface Goal { title: string; tag?: DiffName; sub: string; prog: string; to?: { content: ContentKey; diff: DiffName } }
/** 목표 한 줄 글 (aria · 두 번째 줄) */
const goalText = (g: Goal) => `${g.title}${g.tag ? ` · ${g.tag}` : ''}${g.sub && !g.tag ? ` · ${g.sub}` : ''}`;

/** 아직 한 번도 안 깬 열린 장소 (탐험 · 던전, 낮은 레벨부터, 34 5-2). 첫 던전 녹슨 요새는 쉬움, 나머지는 보통 */
function freshPlace(): { content: ContentKey; diff: DiffName } | null {
  const c = CONTENT.filter(x => x.ready && !x.hidden && x.kind !== 'raid' && !lockOf(x).locked && !G.save.clears[x.key])
    .sort((a, b) => a.unlockLv - b.unlockLv)[0];
  return c ? { content: c.key, diff: c.key === 'rustfort' ? '쉬움' : '보통' } : null;
}

/** 다음 목표 줄: 안 깬 열린 장소 → 녹슨 요새 아직 안 깬 난이도 → 다음 레벨 마일스톤 (이 빌드에 있는 것) */
function goals(): Goal[] {
  const out: Goal[] = [];
  const rec = G.save.clears.rustfort, lvNow = G.save.player.level;
  const fresh = freshPlace();
  if (fresh) out.push({ title: contentOf(fresh.content).name, tag: fresh.diff, sub: '클리어', prog: '0/1', to: fresh });
  const diff = rec && (['보통', '어려움', '악몽'] as const).find(d => !rec[d]);
  if (diff) out.push({ title: '녹슨 요새', tag: diff, sub: '클리어', prog: '0/1', to: { content: 'rustfort', diff } });
  let lv = lvNow;
  for (let i = 0; i < 20; i++) {
    const m = nextMilestone(lv);
    if (!m) break;
    const live = m.items.filter(x => x.live);
    // 괄호 설명은 빼고 첫 항목만 (목표 칸이 좁음)
    if (live.length) { out.push({ title: `Lv ${m.level}`, sub: live[0].text.replace(/\s*\(.*\)\s*$/, ''), prog: `${lvNow}/${m.level}` }); break; }
    lv = m.level;
  }
  return out.slice(0, 2);
}

/** 권장 장비 (편성 화면 경고와 같은 값) — 목표 aria 설명용 */
const recLabel = (d: DiffName) => (RECOMMENDED[d] ? ` · 권장 ${RECOMMENDED[d]!.label}` : '');

/** 목표 칸 머리: 던전 그림 + 「다음 목표」 */
const trkHead = () => `<span class="trk-h">${gameIcon('dungeon', uiIcon('battle'))}<span>다음 목표</span></span>`;

/**
 * 레이드 문 (18 3-3): 레벨이 가까워지면 남은 조건을 체크 목록으로. 길드원 수는 그 전 레벨에서 둘 수 있는 최대 (6명·12명), 길드를 빼 두면 그 줄 없음.
 * 권장 파티 전투력 줄은 17 9-3 식이 정해지면 추가
 */
const GATES: { lv: number; from: number; name: string; grade: ItemGrade }[] = [
  { lv: 35, from: 25, name: '심연의 탑', grade: '희귀' },
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
  const inner = `${trkHead()}${main}${rest.map(g => `<span class="obj dim"><i></i><span>${esc(goalText(g))}</span><small>${g.prog}</small></span>`).join('')}`;
  return to >= 0
    ? `<button type="button" class="lb-trk" data-goal="${to}" aria-label="다음 목표: ${esc(goalText(gs[to]))}${recLabel(gs[to].to!.diff)}">${inner}</button>`
    : `<div class="lb-trk">${inner}</div>`;
}

/** 「출전」 목적지: 첫 던전 차례면 녹슨 요새 쉬움 → 지난 판의 콘텐츠·난이도 → 안 깬 열린 장소 → 녹슨 요새의 아직 안 깬 난이도 */
function dest(): { content: ContentKey; diff: DiffName } {
  if (firstDungeonNow()) return { content: 'rustfort', diff: '쉬움' };
  const last = G.save.last;
  if (last) {
    const c = contentOf(last.content as ContentKey);
    if (c && c.ready && !lockOf(c, last.diff).locked) return { content: c.key, diff: last.diff };
  }
  const fresh = freshPlace();
  if (fresh) return fresh;
  const rec = G.save.clears.rustfort || {};
  return { content: 'rustfort', diff: (['보통', '어려움', '악몽'] as const).find(d => !rec[d]) || '어려움' };
}
function toParty(to: { content: ContentKey; diff: DiffName }): void {
  Flow.content = to.content; Flow.diff = to.diff; Flow.chal = 0;
  Flow.party = null; Flow.rerolls = 0;
  go('s-party');
}

/** 원형 소켓 바로가기: 전투 스킬 칸과 같은 spell-socket 안에 그림, 아래 이름 + 짧은 상태 */
function socket(cls: string, attrs: string, icon: string, name: string, sub: string, extra = ''): string {
  return `<div class="lb-sc ${cls}"><button type="button" class="lb-main"${attrs}><span class="lb-sock">${icon}</span><b>${name}</b>${sub ? `<small>${sub}</small>` : ''}</button>${extra}</div>`;
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

/** 오른쪽 황동 패널: 첨탑 = 10인 레이드, 길드 회관 (길드를 빼 두면 없음), 잡화점. 아래 「다시」 소켓 */
function buildings(): string {
  const s = G.save;
  const raid = contentOf('abyss1'), raidLock = lockOf(raid).locked;
  const plate = (cls: string, attrs: string, icon: string, name: string, sub: string, extra = '') =>
    `<button type="button" class="lb-plate ${cls}"${attrs}>${icon}<span class="lb-pt"><b>${name}</b><span>${sub}</span></span>${extra}</button>`;
  const gOpen = guildOpen(s), apps = (s.guild.post?.cands.length || 0) + s.guild.scouts.length;
  const gLine = !gOpen.ok ? gOpen.why : apps ? `지원자 ${apps}명` : `길드원 ${s.guild.members.length}/${capOf(s).cap}`;
  const plates = plate(`lb-raid${raidLock ? ' lock' : ''}`, ' data-go="s-content" data-arg="raid10"', gameIcon('raid', uiIcon('star')), '첨탑',
    raidLock ? `10인 레이드 · Lv ${raid.unlockLv}에 열림` : `10인 레이드 · 열쇠 ${s.wallet.shards}/${SHARD_MAX}`)
    + (FEATURES.guild ? plate(`lb-guild${gOpen.ok ? '' : ' lock'}`, ' data-go="s-guild"', gameIcon('guild', uiIcon('guild'), 'tab'), '길드 회관', esc(gLine), gOpen.ok && apps ? `<i class="g-badge">${apps}</i>` : '') : '')
    + plate('lb-shop', ' data-go="s-shop" data-arg="gold"', gameIcon('shop', uiIcon('shop'), 'tab'), '잡화점', '골드 상점');
  const last = s.last, lastC = last ? contentOf(last.content as ContentKey) : null;
  const again = last && lastC
    ? socket('lb-again', ` id="lbAgain" aria-label="다시 · ${esc(lastC.name)} ${esc(last.diff)}"`, gameIcon('replay', REPLAY_SVG), '다시', last.win ? esc(last.grade || '클리어') : esc(last.diff))
    : '';
  return `<div class="lb-side lb-right">${plates}${again ? `<span class="lb-fill"></span>${again}` : ''}</div>`;
}

/** 아래 패널: 다음 목표 칸 + 「출전」 (지난 판 → 안 깬 장소) + 시즌 패스 */
function journey(tutDone: boolean): string {
  const to = dest(), c = contentOf(to.content);
  const cta = `<button type="button" class="lb-cta${firstDungeonNow() ? ' hi-pulse' : ''}" id="lobbyStart" aria-label="출전 · ${esc(c.name)} ${esc(to.diff)}">${gameIcon('battle', uiIcon('battle'), 'tab')}<b>출전</b><small>${esc(c.name)} · ${esc(to.diff)}</small></button>`;
  const plv = Math.min(PASS_LEVELS, passLevel(G.save.pass.xp));
  const pass = tutDone
    ? `<button type="button" class="lb-pass" data-go="s-shop" data-arg="pass" aria-label="시즌 패스 ${plv} / ${PASS_LEVELS}">${gameIcon('pass', PASS_SVG)}<span>패스 ${plv}</span></button>`
    : '';
  return `<div class="lb-journey">${tracker()}<div class="lb-go">${cta}${pass}</div></div>`;
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
          ${journey(tutDone)}
        </div>
        ${st.msg ? `<p class="warnbox lb-msg" role="status">${esc(st.msg)}</p>` : ''}
      </div>
    </div>`;
  // 살아 있는 마을: 같은 캔버스를 새 무대로 옮겨 붙여 움직임이 이어짐 (보상 받기로 다시 그려도)
  mountVillage(s.el.querySelector('.lb-stage'));
  st.msg = '';
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement, save = G.save, now = Date.now();
  if (t.closest('#lobbyStart')) { toParty(dest()); return; }
  const gr = t.closest<HTMLElement>('[data-goal]');
  if (gr) { const g = goals()[Number(gr.dataset.goal)]; if (g?.to) toParty(g.to); return; }
  if (t.closest('#lbAgain') && save.last) { toParty({ content: save.last.content as ContentKey, diff: save.last.diff }); return; }
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
