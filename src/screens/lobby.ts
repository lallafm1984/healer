/**
 * S02 로비 = 마을 광장 (30 0장, 시안 「30 · 로비 A」 Lobby30). 캐릭터 그림 없음.
 * 같은 2:3 무대의 하늘·원경·전경 레이어 위에 광장 물건 + 이름표:
 *  종탑 = 10인 레이드 · 길드 회관(길드를 빼 두면 이름표 없음) · 잡화점(골드 상점) · 모래시계 석상 = 주간 도전 · 임무 게시판(받을 것 있으면 노란 「!」) · 일일 상자.
 * 왼쪽 위 목표 추적 (레이드 문 앞이면 체크 목록), 아래 줄 = 「다시」 메달 · 「출전」 · 「시즌 패스」 메달.
 * 받기·열기는 그 자리에서 (게시판 「!」 = 임무 한 번에 받기, 상자 = 열기). 튜토리얼 중엔 목표 추적 + 출전 + 안내만.
 * 건물 이름표·광장 물건은 그림 비율 2:3 「무대」 안에 %로 → 화면 크기가 달라도 같은 지점을 가리킴.
 */
import { art } from '../art';
import { contentOf, type ContentKey } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { ITEM_GRADES, RECOMMENDED, SLOTS, type ItemGrade } from '../data/equipment';
import { CHAL } from '../data/challenge';
import { PASS_LEVELS, SHARD_MAX } from '../data/economy';
import { FEATURES } from '../data/features';
import { guildCap } from '../data/guild';
import { CONTENT_PLACE, PLACES } from '../data/places';
import { nextMilestone } from '../data/progression';
import { weekRemaining } from '../game/clock';
import { chestState, claimChalChest, claimChest, claimMission, missionReady, passLevel } from '../game/economy';
import { Flow } from '../game/flow';
import { capOf, guildOpen } from '../game/guild';
import { chalGate } from '../game/runmode';
import { commit, G, lockOf, refreshDay } from '../game/state';
import { TUT } from '../game/tutorial';
import { esc, go, screen, topBar } from './kit';
import { factionMark, gameIcon } from './art';
import { gainText } from './shop';

// ---------- 광장 물건 임시 그림 (시안 Lobby30 선그림. obj-board · obj-hourglass · obj-chest가 오면 그 그림) ----------
const BOARD_SVG = `<svg viewBox="0 0 112 124" aria-hidden="true"><g stroke="#0E0E15" stroke-width="3" stroke-linejoin="round"><rect x="14" y="24" width="9" height="98" fill="#5A3B22"/><rect x="89" y="24" width="9" height="98" fill="#5A3B22"/><path d="M2 30L56 6L110 30Z" fill="#7A2E22"/><rect x="8" y="32" width="96" height="64" rx="2" fill="#8A6038"/><rect x="15" y="38" width="26" height="32" fill="#EADFC0" transform="rotate(-5 28 54)"/><rect x="45" y="40" width="22" height="26" fill="#EADFC0" transform="rotate(4 56 53)"/><rect x="71" y="37" width="26" height="34" fill="#EADFC0" transform="rotate(-2 84 54)"/><rect x="30" y="72" width="34" height="18" fill="#EADFC0" transform="rotate(2 47 81)"/></g><g stroke="#8A7A5A" stroke-width="1.6" stroke-linecap="round"><path d="M20 48h15M20 54h13M20 60h15"/><path d="M76 47h16M76 53h14M76 59h16"/><path d="M36 80h22"/></g><circle cx="28" cy="41" r="3" fill="#C8281E" stroke="#0E0E15" stroke-width="1.5"/><circle cx="56" cy="43" r="3" fill="#C8281E" stroke="#0E0E15" stroke-width="1.5"/><circle cx="84" cy="40" r="3" fill="#C8281E" stroke="#0E0E15" stroke-width="1.5"/><path d="M50 54l6-6 6 6-6 6z" fill="#FFD34D" stroke="#0E0E15" stroke-width="1.5"/></svg>`;
const HOURGLASS_SVG = `<svg viewBox="0 0 64 102" aria-hidden="true"><g stroke="#0E0E15" stroke-width="3" stroke-linejoin="round"><rect x="6" y="80" width="52" height="19" fill="#5E5A52"/><rect x="13" y="71" width="38" height="11" fill="#7C766C"/><path d="M18 14h28c0 16-11 19-11 25s11 9 11 25H18c0-16 11-19 11-25s-11-9-11-25z" fill="#CFE0F2" fill-opacity="0.35"/><rect x="10" y="7" width="44" height="8" rx="2" fill="#C9A35C"/><rect x="10" y="63" width="44" height="8" rx="2" fill="#C9A35C"/></g><path d="M22 61h20l-10-11z" fill="#E2C27A"/><path d="M24 18h16l-8 11z" fill="#E2C27A"/><path d="M32 30v20" stroke="#E2C27A" stroke-width="1.5"/><path d="M20 89h24" stroke="#3E3A34" stroke-width="2"/></svg>`;
const CHEST_SVG = `<svg viewBox="0 0 84 70" aria-hidden="true"><g stroke="#0E0E15" stroke-width="3" stroke-linejoin="round"><rect x="6" y="30" width="72" height="36" rx="3" fill="#7A4A26"/><path d="M6 32c0-16 12-26 36-26s36 10 36 26z" fill="#93602F"/><rect x="18" y="12" width="9" height="54" fill="#D9A84A"/><rect x="57" y="12" width="9" height="54" fill="#D9A84A"/><rect x="35" y="24" width="14" height="18" rx="2" fill="#F2C75A"/></g><circle cx="42" cy="32" r="2.6" fill="#3A2410"/><path d="M76 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFE7A0"/><path d="M6 6l1.4 3.6 3.6 1.4-3.6 1.4L6 16l-1.4-3.6L1 11l3.6-1.4z" fill="#FFE7A0"/></svg>`;
// 메달 선 아이콘 (icon-replay · icon-pass가 오면 그 그림)
const REPLAY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>';
const PASS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/></svg>';

/** 별은 고정 좌표에서 밝기만 변화. 재렌더 때 위치가 바뀌지 않도록 난수를 쓰지 않는다. */
function skyStars(): string {
  const stars = [
    [18, 5, 1, 6.2, -2.1], [41, 4, 1, 5.4, -4.2], [67, 8, 1.3, 6.8, -1.8],
    [87, 12, 1, 5.8, -3.6], [29, 13, 1, 6.6, -5.3], [53, 16, 1.3, 5.2, -1.1],
    [74, 18, 1, 6.4, -4.8], [38, 21, 1, 5.6, -2.7], [61, 24, 1.5, 6.9, -5.7],
    [83, 27, 1, 5.3, -1.9], [24, 29, 1, 6.1, -4.3], [47, 32, 1.3, 5.7, -3.1],
    [70, 34, 1, 6.7, -2.4], [33, 36, 1, 5.1, -4.1], [56, 39, 1.3, 6.3, -1.4],
    [79, 41, 1, 5.9, -3.8], [45, 10, 1, 6.5, -5.9], [64, 30, 1, 5.5, -2.9],
    [21, 19, 1, 6.8, -3.4], [57, 7, 1, 5.4, -1.6], [49, 26, 1, 6.6, -4.7],
    [73, 11, 1, 5.8, -2.2], [35, 28, 1.3, 6.2, -5.1], [59, 35, 1, 5.6, -3.3],
  ];
  return `<div class="lb-stars">${stars.map(([x, y, size, duration, delay]) =>
    `<span class="lb-star" style="left:${x}%;top:${y}%;--star-size:${size}px;--star-duration:${duration}s;--star-delay:${delay}s"></span>`).join('')}</div>`;
}

/** 남색 하늘 → 작은 별 → 흐르는 구름 순서. 구름 준비 전에는 기존 하늘 그림 유지. */
function sceneLayers(): string {
  const clouds = art('scene-lobby-clouds-v3'), sky = art('scene-lobby-sky-v2');
  const images = (['landscape', 'foreground'] as const).map(layer => ({ layer, src: art(`scene-lobby-${layer}-v2`) }));
  if ((!clouds && !sky) || images.some(image => !image.src)) return '';
  const skyLayer = clouds
    ? `<div class="lb-layer lb-layer-sky">${skyStars()}<div class="lb-cloud-track">${[0, 1].map(() => `<img class="lb-cloud-tile" src="${esc(clouds)}" width="2160" height="720" alt="" decoding="async" draggable="false">`).join('')}</div></div>`
    : `<img class="lb-layer lb-layer-sky" src="${esc(sky)}" width="1024" height="1536" alt="" decoding="async" draggable="false">`;
  return `<div class="lb-layers" aria-hidden="true">${skyLayer}${images.map(({ layer, src }) => `<img class="lb-layer lb-layer-${layer}" src="${esc(src)}" width="1024" height="1536" alt="" decoding="async" draggable="false">`).join('')}</div>`;
}

/** 바닥 접점에 맞춘 새 소품. 없으면 기존 그림·선그림 순으로 대체. */
function propArt(name: 'board' | 'hourglass' | 'chest', fallback: string): string {
  const v3 = art(`obj-${name}-v3`), src = v3 || art(`obj-${name}-v2`);
  return src
    ? `<img class="g-ic ${v3 ? 'lb-prop-v3' : 'lb-prop-v2'}" src="${esc(src)}" alt="" decoding="async" draggable="false">`
    : gameIcon(name, fallback, 'obj');
}

const st = { msg: '' };

/** 목표 한 줄: prog = 진행 n/m, to = 누르면 그 콘텐츠의 편성 화면 */
interface Goal { text: string; prog: string; to?: { content: ContentKey; diff: DiffName } }

/** 다음 목표 줄: 녹슨 요새 아직 안 깬 난이도 → 다음 레벨 마일스톤 (이 빌드에 있는 것) */
function goals(): Goal[] {
  const out: Goal[] = [];
  const rec = G.save.clears.rustfort || {}, lvNow = G.save.player.level;
  if (G.save.tut < TUT.done) out.push({ text: '녹슨 요새 「쉬움」 클리어', prog: '0/1', to: { content: 'rustfort', diff: '쉬움' } });
  const diff = G.save.tut < TUT.done ? null : (['보통', '어려움', '악몽'] as const).find(d => !rec[d]);
  if (diff) out.push({ text: `녹슨 요새 「${diff}」 클리어`, prog: '0/1', to: { content: 'rustfort', diff } });
  let lv = lvNow;
  for (let i = 0; i < 20; i++) {
    const m = nextMilestone(lv);
    if (!m) break;
    const live = m.items.filter(x => x.live);
    // 괄호 설명은 빼고 첫 항목만 (목표 추적 칸이 좁음)
    if (live.length) { out.push({ text: `Lv ${m.level} · ${live[0].text.replace(/\s*\(.*\)\s*$/, '')}`, prog: `${lvNow}/${m.level}` }); break; }
    lv = m.level;
  }
  return out.slice(0, 2);
}

/** 권장 장비 (편성 화면 경고와 같은 값) — 목표 줄 aria 설명용 */
const recLabel = (d: DiffName) => (RECOMMENDED[d] ? ` · 권장 ${RECOMMENDED[d]!.label}` : '');

/**
 * 레이드 문 (18 3-3): 레벨이 가까워지면 남은 조건을 체크 목록으로. 길드원 수는 그 전 레벨에서 둘 수 있는 최대 (6명·12명), 길드를 빼 두면 그 줄 없음.
 * 권장 파티 전투력 줄은 17 9-3 식이 정해지면 추가
 */
const GATES: { lv: number; from: number; name: string; grade: ItemGrade }[] = [
  { lv: 35, from: 25, name: '심연의 종탑', grade: '희귀' },
  { lv: 70, from: 55, name: '가라앉은 대성당', grade: '영웅' },
];
/** 레이드 문 시기면 목표 추적 = 체크 목록. 누르면 아직 안 된 첫 줄의 화면 (길드·캐릭터) */
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
  const inner = `<span class="trk-h">다음 목표</span><span class="trk-sub">${g.name} · Lv ${g.lv}</span>
    ${rows.map(([ok, k, v]) => `<span class="obj${ok ? ' ok' : ''}"><i></i><span>${k}</span><small>${v}</small></span>`).join('')}`;
  return to
    ? `<button type="button" class="lb-trk gate" data-go="${to}"${to === 's-char' ? ' data-arg="gear"' : ''}>${inner}</button>`
    : `<div class="lb-trk gate">${inner}</div>`;
}

/** 왼쪽 위 목표 추적 (마름모 줄 2개). 누르면 첫 목적지 편성 화면 */
function tracker(): string {
  const gate = gateTracker();
  if (gate) return gate;
  const gs = goals(), to = gs.findIndex(g => g.to);
  const inner = `<span class="trk-h">다음 목표</span>
    ${gs.map((g, i) => `<span class="obj${i ? ' dim' : ' cur'}"><i></i><span>${esc(g.to ? g.text.replace(/「([^」]+)」 클리어$/, '· $1') : g.text)}</span><small>${g.prog}</small></span>`).join('')}`;
  return to >= 0
    ? `<button type="button" class="lb-trk" data-goal="${to}" aria-label="다음 목표: ${esc(gs[to].text)}${recLabel(gs[to].to!.diff)}">${inner}</button>`
    : `<div class="lb-trk">${inner}</div>`;
}

/** 「출전」 목적지: 지난 판의 콘텐츠·난이도, 처음이면 추천 (녹슨 요새의 아직 안 깬 난이도). 튜토리얼 던전 차례면 녹슨 요새 쉬움 */
function dest(): { content: ContentKey; diff: DiffName } {
  if (G.save.tut < TUT.done) return { content: 'rustfort', diff: '쉬움' };
  const last = G.save.last;
  if (last) {
    const c = contentOf(last.content as ContentKey);
    if (c && c.ready && !lockOf(c, last.diff).locked) return { content: c.key, diff: last.diff };
  }
  const rec = G.save.clears.rustfort || {};
  return { content: 'rustfort', diff: (['보통', '어려움', '악몽'] as const).find(d => !rec[d]) || '어려움' };
}
function toParty(to: { content: ContentKey; diff: DiffName }): void {
  Flow.content = to.content; Flow.diff = to.diff; Flow.chal = 0;
  Flow.party = null; Flow.rerolls = 0;
  go('s-party');
}

/** 그림 위 건물 이름표 (무대 안 %): 종탑 = 10인 레이드, 길드 회관 (길드를 빼 두면 없음), 잡화점 */
function buildings(): string {
  const s = G.save;
  const raid = contentOf('abyss1'), raidLock = lockOf(raid).locked;
  const gOpen = guildOpen(s), apps = (s.guild.post?.cands.length || 0) + s.guild.scouts.length;
  const gLine = !gOpen.ok ? gOpen.why : apps ? `지원자 ${apps}명` : `길드원 ${s.guild.members.length}/${capOf(s).cap}`;
  return `<button type="button" class="g-plate pr lb-raid${raidLock ? ' lock' : ''}" data-go="s-content" data-arg="raid10"><b>종탑</b>${raidLock ? `<span>10인 레이드</span><span>Lv ${raid.unlockLv}에 열림</span>` : `<span>10인 레이드 · 조각 ${s.wallet.shards}/${SHARD_MAX}</span>`}</button>
    ${FEATURES.guild ? `<button type="button" class="g-plate lb-guild${gOpen.ok ? '' : ' lock'}" data-go="s-guild"><b>길드 회관</b><span>${esc(gLine)}</span>${gOpen.ok && apps ? `<i class="g-badge">${apps}</i>` : ''}</button>` : ''}
    <button type="button" class="g-plate lb-shop" data-go="s-shop" data-arg="gold"><b>잡화점</b><span>골드 상점</span></button>`;
}

/** 광장 물건 (전경과 같은 무대 좌표): 모래시계 석상 = 주간 도전, 임무 게시판, 일일 상자 */
function square(): string {
  const s = G.save, d = s.daily, w = s.weekly;
  // 주간 도전: 이번 주 남은 날 (잠기면 해금 레벨). 도전 상자가 있으면 이름표 = 받기
  const cg = chalGate(s), left = weekRemaining();
  const chal = s.chalChest
    ? `<span class="g-qm" aria-hidden="true">!</span><button type="button" class="lb-art" data-act="chal" aria-label="주간 도전 상자 받기">${propArt('hourglass', HOURGLASS_SVG)}</button>
      <button type="button" class="g-plate" id="lbChal"><b>주간 도전</b><span>상자 받기</span><i class="g-badge">!</i></button>`
    : `<button type="button" class="lb-art" data-go="s-content" data-arg="dungeon" tabindex="-1" aria-hidden="true">${propArt('hourglass', HOURGLASS_SVG)}</button>
      <button type="button" class="g-plate${cg.ok ? '' : ' lock'}" data-go="s-content" data-arg="dungeon" aria-label="주간 도전 · ${esc(CHAL.name)} · ${cg.ok ? `${left} 남음` : `Lv ${cg.lv}에 열림`}"><b>주간 도전</b><span>${cg.ok ? `${left} 남음` : `Lv ${cg.lv}에 열림`}</span></button>`;
  // 임무: 받을 것이 있으면 게시판 위 노란 「!」 + 이름표 빨간 숫자. 게시판을 누르면 한 번에 받기, 이름표는 임무 화면
  const dGot = d.missions.filter(m => m.got).length, wGot = w.missions.filter(m => m.got).length;
  const ready = d.missions.filter(missionReady).length + w.missions.filter(missionReady).length;
  const mLine = `일일 ${dGot}/${d.missions.length}${w.missions.length ? ` · 주간 ${wGot}/${w.missions.length}` : ''}`;
  const board = ready
    ? `<span class="g-qm" aria-hidden="true">!</span><button type="button" class="lb-art" id="lbClaim" aria-label="임무 보상 ${ready}개 받기">${propArt('board', BOARD_SVG)}</button>`
    : `<button type="button" class="lb-art" data-go="s-missions" tabindex="-1" aria-hidden="true">${propArt('board', BOARD_SVG)}</button>`;
  // 일일 상자: 열 수 있으면 「열기」와 배지
  const ch = chestState(s), open = ch.today || ch.banked > 0;
  // 닫혀 있으면 여는 조건 진행 (임무 n/5 받음) 또는 「내일 다시」. 이름표가 좁아서 짧게
  const cLine = open ? `열기${ch.banked ? ` · ${ch.banked}일 쌓임` : ''}` : d.chest ? '내일 다시' : `임무 ${dGot}/${d.missions.length}`;
  const chest = open
    ? `<button type="button" class="lb-art" data-act="chest" tabindex="-1" aria-hidden="true">${propArt('chest', CHEST_SVG)}</button>
      <button type="button" class="g-plate" id="lbChest"><b>일일 상자</b><span>${cLine}</span><i class="g-badge">!</i></button>`
    : `<button type="button" class="lb-art" data-go="s-missions" tabindex="-1" aria-hidden="true">${propArt('chest', CHEST_SVG)}</button>
      <button type="button" class="g-plate lock" data-go="s-missions"><b>일일 상자</b><span>${cLine}</span></button>`;
  return `<div class="lb-obj lb-chal${cg.ok ? '' : ' off'}">${chal}</div>
    <div class="lb-obj lb-board lb-missions">${board}<button type="button" class="g-plate lb-rmain" data-go="s-missions"><b>임무</b><span>${mLine}</span>${ready ? `<i class="g-badge">${ready}</i>` : ''}</button></div>
    <div class="lb-obj lb-chest${open ? '' : ' off'}">${chest}</div>`;
}

/** 아래 줄: 「다시」 메달 (지난 판) · 「출전」 · 「시즌 패스」 메달 */
function dock(tutDone: boolean): string {
  const to = dest(), c = contentOf(to.content), f = PLACES[CONTENT_PLACE[to.content]].faction;
  const cta = `<button type="button" class="g-cta lb-cta${G.save.tut === TUT.dungeon ? ' hi-pulse' : ''}" id="lobbyStart" aria-label="출전 · ${esc(c.name)} ${esc(to.diff)}"><span class="g-mk">${factionMark(f)}</span><span class="g-ct"><b>출전</b><small>${esc(c.name)} · ${esc(to.diff)}</small></span></button>`;
  if (!tutDone) return cta;
  const last = G.save.last, lastC = last ? contentOf(last.content as ContentKey) : null;
  const again = last && lastC
    ? `<button type="button" class="g-med lb-again" id="lbAgain" aria-label="다시 · ${esc(lastC.name)} ${esc(last.diff)}"><span class="g-ring">${gameIcon('replay', REPLAY_SVG)}</span><span class="g-lb">다시${last.win ? ` · ${esc(last.grade || '클리어')}` : ''}</span></button>`
    : '';
  const plv = Math.min(PASS_LEVELS, passLevel(G.save.pass.xp));
  const pass = `<button type="button" class="g-med lb-pass" data-go="s-shop" data-arg="pass" aria-label="시즌 패스 ${plv} / ${PASS_LEVELS}"><span class="g-ring">${gameIcon('pass', PASS_SVG)}</span><span class="g-lb">패스 ${plv}</span><span class="g-pbar"><i style="width:${((plv / PASS_LEVELS) * 100).toFixed(0)}%"></i></span></button>`;
  return again + cta + pass;
}

const s = screen('s-lobby', '로비', {
  tab: 'lobby',
  enter() { refreshDay(); render(); },
});

/** 화면 전환은 [hidden]으로, 백그라운드 탭은 문서 상태로 CSS 애니메이션만 일시정지. */
function syncSceneMotion(): void {
  s.el.classList.toggle('lb-motion-paused', document.hidden);
}
document.addEventListener('visibilitychange', syncSceneMotion);
syncSceneMotion();

function render(): void {
  // 보상 수령으로 DOM을 다시 그려도 구름이 오른쪽 처음 위치로 튀지 않게 진행 시간 유지.
  const cloudTime = s.el.querySelector('.lb-cloud-track')?.getAnimations()[0]?.currentTime;
  const tutDone = G.save.tut >= TUT.done;
  const layers = sceneLayers();
  s.el.innerHTML = `${topBar({ settings: true })}
    <div class="ns-body lb30${tutDone ? '' : ' tut'}">
      <div class="lb-world">
        <div class="lb-stage${layers ? ' has-layers' : ''}"><div class="lb-canvas">${layers}${tutDone ? square() : ''}</div>${tutDone ? buildings() : ''}</div>
        <div class="lb-shade" aria-hidden="true"></div>
        ${tracker()}
        ${dock(tutDone)}
        ${G.save.tut === TUT.dungeon ? '<p class="coachtip lb-coach">이제 첫 던전 <b>녹슨 요새</b> 차례. 「출전」 누르기</p>' : ''}
        ${st.msg ? `<p class="warnbox lb-msg" role="status">${esc(st.msg)}</p>` : ''}
      </div>
    </div>`;
  const cloudAnimation = s.el.querySelector('.lb-cloud-track')?.getAnimations()[0];
  if (cloudAnimation && cloudTime != null) cloudAnimation.currentTime = cloudTime;
  st.msg = '';
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement, save = G.save, now = Date.now();
  if (t.closest('#lobbyStart')) { toParty(dest()); return; }
  const gr = t.closest<HTMLElement>('[data-goal]');
  if (gr) { const g = goals()[Number(gr.dataset.goal)]; if (g?.to) toParty(g.to); return; }
  if (t.closest('#lbAgain') && save.last) { toParty({ content: save.last.content as ContentKey, diff: save.last.diff }); return; }
  if (t.closest('#lbClaim')) {
    // 받을 수 있는 임무를 한 번에 (주간은 종 조각이 가득이면 남김)
    const got: string[] = [];
    for (const kind of ['daily', 'weekly'] as const) (kind === 'daily' ? save.daily : save.weekly).missions.forEach((m, i) => {
      if (!missionReady(m)) return;
      const r = claimMission(save, kind, i, now);
      got.push(typeof r === 'string' ? r : gainText(r));
    });
    st.msg = got.length ? `임무 보상: ${got.join(' · ')}` : '';
    commit(); render(); return;
  }
  if (t.closest('#lbChest, [data-act="chest"]')) { const r = claimChest(save, Math.random, now); st.msg = typeof r === 'string' ? r : `일일 상자: ${gainText(r)}`; commit(); render(); return; }
  if (t.closest('#lbChal, [data-act="chal"]')) { const r = claimChalChest(save, Math.random, now); st.msg = typeof r === 'string' ? r : `주간 도전 상자: ${gainText(r)}`; commit(); render(); }
});
