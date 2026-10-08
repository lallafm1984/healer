/**
 * 첫 5분 튜토리얼 (02 11장, 09 4장): 이야기 → 2인 첫 전투(탭 힐) → Lv 2 소생 → 3인 탐험(소생·순간 치유) → 로비.
 * 그 뒤(녹슨 요새 첫 클리어까지)는 로비·콘텐츠·편성 화면이 save.tut을 보고 안내한다.
 */
import { contentOf } from '../data/content';
import { gearStatsOf } from '../data/equipment';
import { addXp, xpToNext } from '../data/progression';
import { recruitParty } from '../engine';
import { Flow, newSeed } from '../game/flow';
import { commit, G, healerLevel, itemsNow } from '../game/state';
import { DUO_PARTY, TUT } from '../game/tutorial';
import { battle, go, screen } from './kit';
import { depart } from './party';
import { classEmblem } from './art';

const DEV_SKIP = '<button class="btn ghost" type="button" id="tutSkip">튜토리얼 건너뛰기 (개발 빌드)</button>';

/** 개발 빌드: 튜토리얼 없이 로비로 */
function skip(): void { G.save.tut = TUT.done; commit(); go('s-lobby'); }

// ---------- 이야기 (짧게) ----------
const story = screen('s-story', '이야기', {
  enter() {
    story.el.innerHTML = `<div class="ns-body story">
      <div class="story-art">${classEmblem('priest', 'xl')}</div>
      <h2 class="h">라스트 온라인</h2>
      <p>이 서버에는 힐러를 하는 사람이 거의 없다.</p>
      <p>파티 찾기에는 오늘도 「힐러 구함」이 가득하다.</p>
      <p>당신은 이 서버에 몇 안 되는 사제다. 첫 파티원이 기다리고 있다.</p>
    </div>
    <footer class="ns-foot col"><button class="btn primary" type="button" id="tutGo">첫 전투 시작</button>${DEV_SKIP}</footer>`;
  },
});
story.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (t.closest('#tutGo')) startDuo();
  else if (t.closest('#tutSkip')) skip();
});

/** 2인 첫 전투: 탱커 1 + 나, 쉬움 */
function startDuo(): void {
  const c = contentOf('tutorial');
  const { slots, items } = itemsNow();
  battle().start({
    content: c.key, name: c.name, segs: c.fights('쉬움'), diff: '쉬움', level: healerLevel(), heroLv: G.save.player.level, stageLv: c.stageLv, gearStats: gearStatsOf(G.save.gear.equipped),
    party: DUO_PARTY, items, slots, seed: newSeed(), coach: 'duo', hero: 'priest',
    onEnd(r) {
      if (!r.win) { go('s-tut', 'lose'); return; }
      // 첫 전투를 깨면 Lv 2 (소생). 다시 보기로 하는 거면 레벨은 그대로
      const p = G.save.player;
      if (p.level < 2) addXp(p, xpToNext(1) - p.xp);
      if (G.save.tut === TUT.intro) G.save.tut = TUT.explore;
      commit();
      go('s-tut', 'win');
    },
  });
}

/** 3인 탐험 「녹슨 고원」 쉬움. 끝나면 보통 정산·보상으로 (탐험은 튜토리얼 뒤에도 하는 콘텐츠) */
function startExplore(): void {
  Flow.content = 'plateau'; Flow.diff = '쉬움'; Flow.seed = newSeed(); Flow.rerolls = 0;
  Flow.party = recruitParty(contentOf('plateau').fights('쉬움')[0], Flow.seed);
  Flow.coach = 'explore';
  depart();
}

// ---------- 단계 사이 카드 ----------
const card = screen('s-tut', '튜토리얼', {
  enter(arg) {
    const lose = arg === 'lose';
    if (lose) {
      card.el.innerHTML = `<div class="ns-body story"><h2 class="h">탱커가 쓰러짐</h2>
        <p>탱커 칸을 자주 탭하기. 탭 한 번에 치유 한 번.</p>
        <p>체력이 반쯤 줄었을 때 미리 탭하면 넉넉함.</p></div>
        <footer class="ns-foot col"><button class="btn primary" type="button" id="tutRetry">다시 하기</button>${DEV_SKIP}</footer>`;
      return;
    }
    card.el.innerHTML = `<div class="ns-body story">
      <h2 class="h">첫 파티 성공!</h2>
      <section class="panel learn"><h2>Lv ${G.save.player.level} · 새 스킬 「소생」</h2>
        <p>칸에 걸어 두면 9초 동안 저절로 차는 힐. 칸에서 휠과 같은 방향으로 쓸어서도 쓸 수 있음.</p></section>
      <p>다음은 <b>3인 탐험 「녹슨 고원」</b>. 파티 찾기로 두 명이 들어옴.</p>
    </div>
    <footer class="ns-foot col"><button class="btn primary" type="button" id="tutNext">탐험 출발</button>${DEV_SKIP}</footer>`;
  },
});
card.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  if (t.closest('#tutRetry')) startDuo();
  else if (t.closest('#tutNext')) startExplore();
  else if (t.closest('#tutSkip')) skip();
});

/** 타이틀을 누르면: 튜토리얼 단계에 맞는 곳으로 */
export function afterTitle(): void {
  const t = G.save.tut;
  if (t === TUT.intro) go('s-story');
  else if (t === TUT.explore) go('s-tut', 'win');
  else go('s-lobby');
}
