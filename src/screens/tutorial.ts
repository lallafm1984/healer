/**
 * 첫 5분 튜토리얼 (02 11장, 09 4장, 34 5-2): 이야기 → 2인 첫 전투(탭 힐) → Lv 2 소생 → 3인 탐험(소생·순간 치유) → 결과 = 끝.
 * 첫 던전 녹슨 요새는 Lv 5에 열리고, 첫 클리어까지 로비·편성 화면이 안내한다 (출전 화면은 장소·난이도만 골라 둠) (game/state firstDungeonNow).
 */
import './intro.css';
import { t } from '../i18n';
import { art } from '../art';
import { contentOf } from '../data/content';
import { gearStatsOf, specsOf } from '../data/equipment';
import { addXp, xpToNext } from '../data/progression';
import { recruitParty } from '../engine';
import { Flow, newSeed } from '../game/flow';
import { commit, G, healerLevel } from '../game/state';
import { DUO_PARTY, TUT, tutReplay } from '../game/tutorial';
import { battle, go, screen } from './kit';
import { depart } from './party';
import { gameIcon, placeArt } from './art';

const devSkip = (className = 'btn ghost') => `<button class="${className}" type="button" id="tutSkip">튜토리얼 건너뛰기 (개발 빌드)</button>`;

/** 개발 빌드: 튜토리얼 없이 로비로 */
function skip(): void { G.save.tut = TUT.done; commit(); go('s-lobby'); }

// ---------- 이야기 (짧게) ----------
const story = screen('s-story', t('이야기'), {
  enter() {
    story.el.classList.toggle('intro-calm', !!G.save.settings.reducedEffects);
    story.el.innerHTML = `<div class="intro-body">
      <figure class="intro-scene"><img src="${art('scene-story-sanctuary-v2')}" alt="${t('치유의 빛이 모험길로 이어지는, 인물 없는 신전 풍경')}" decoding="async" fetchpriority="high"></figure>
      <div class="intro-copy">
        <h1><span class="intro-premise">${t('아무도 하지 않는 힐러,')}</span><span>${t('내가 하겠다.')}</span></h1>
      </div>
    </div>
    <footer class="intro-actions"><button type="button" id="tutGo">${t('첫 전투 시작')}</button>${devSkip('intro-skip')}</footer>`;
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
  battle().start({
    content: c.key, name: c.name, segs: c.fights('쉬움'), diff: '쉬움', level: healerLevel(), heroLv: G.save.player.level, stageLv: c.stageLv, gearStats: gearStatsOf(G.save.gear.equipped, G.save.player.level),
    party: DUO_PARTY, seed: newSeed(), coach: 'duo', hero: 'priest', specs: specsOf(G.save.gear.equipped, 'priest'),
    onEnd(r) {
      if (!r.win) { go('s-tut', r.quit ? 'quit' : 'lose'); return; }
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
  Flow.content = 'plateau'; Flow.diff = '쉬움'; Flow.seed = newSeed();
  Flow.party = recruitParty(contentOf('plateau').fights('쉬움')[0], Flow.seed);
  Flow.coach = 'explore';
  depart();
}

// ---------- 단계 사이 카드 ----------
const card = screen('s-tut', t('튜토리얼'), {
  enter(arg) {
    const lose = arg === 'lose' || arg === 'quit';
    if (lose) {
      card.el.style.removeProperty('--tut-art');
      card.el.innerHTML = `<div class="ns-body story"><h2 class="h">${arg === 'quit' ? t('튜토리얼 중단') : t('탱커가 쓰러짐')}</h2>
        ${arg === 'quit' ? `<p>${t('첫 전투를 중단했습니다. 같은 단계에서 다시 시작할 수 있습니다.')}</p>` : `<p>${t('탱커 칸을 탭하면 치유를 시작합니다.')}</p><p>${t('체력이 반쯤 줄었을 때 미리 치유합니다.')}</p>`}</div>
        <footer class="ns-foot col"><button class="btn primary" type="button" id="tutRetry">${t('다시 하기')}</button>${devSkip()}</footer>`;
      return;
    }
    // 다음 장소 그림을 이야기 화면처럼 어둡게 깔고, 배운 스킬은 그림과 함께 (예전엔 나무결에 글만, 아래 절반이 비었음)
    const next = placeArt('plateau').url;
    card.el.style.setProperty('--tut-art', next ? `url('${next}')` : 'none');
    card.el.innerHTML = `<div class="ns-body story">
      <h2 class="h">${t('첫 파티 성공!')}</h2>
      <section class="panel learn"><span class="learn-art">${gameIcon('renew', '', 'skill')}</span><div><h2>${tutReplay(G.save) ? t('다시 보기 · 스킬 「소생」') : t('Lv {n} · 새 스킬 「소생」', { n: G.save.player.level })}</h2>
        <p>${t('소생을 걸어 두면 9초 동안 체력이 회복됩니다. 칸에서 휠과 같은 방향으로 쓸어서도 사용할 수 있습니다.')}</p></div></section>
      <p>${t('다음은 <b>3인 탐험 「녹슨 고원」</b>입니다. 파티 찾기로 두 명이 들어옵니다.')}</p>
    </div>
    <footer class="ns-foot col"><button class="btn primary" type="button" id="tutNext">${t('탐험 출발')}</button>${devSkip()}</footer>`;
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
