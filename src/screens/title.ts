/** S01 타이틀 (09). 게임 이름은 아직 가제 (21 6장) */
import { sunSvg, uiIcon } from './art';
import { battle, screen } from './kit';
import { afterTitle } from './tutorial';

const s = screen('s-title', '타이틀', {
  enter() {
    s.el.innerHTML = `<div class="t-wrap">
      <div class="t-brand"><div class="t-emblem">${sunSvg}</div>
      <p class="eyebrow">오늘도 힐러 구함</p>
      <h1 class="t-name">나혼자 <span>힐러</span></h1>
      <p class="t-sub">당신의 작은 빛이, 파티를 지킨다.</p></div>
      <div class="t-space" aria-hidden="true"></div>
      <div class="t-bottom"><button class="btn primary" type="button" id="titleStart">모험 시작 ${uiIcon('arrow')}</button>
      <p class="t-tap">화면을 누르면 시작</p>
      <p class="t-ver">개발 빌드 · 게임명은 가제</p></div>
    </div>`;
  },
});
s.el.addEventListener('click', () => { battle().sound('tick'); afterTitle(); });
