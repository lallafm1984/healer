/** S01 타이틀 (09). 게임 이름은 아직 가제 (21 6장) */
import { bellSvg } from './art';
import { battle, screen } from './kit';
import { afterTitle } from './tutorial';

const s = screen('s-title', '타이틀', {
  enter() {
    s.el.innerHTML = `<div class="t-wrap">
      <div class="t-emblem">${bellSvg}</div>
      <h1 class="t-name">나혼자 힐러</h1>
      <p class="t-sub">가제 · 개발 빌드</p>
      <p class="t-tap">화면을 누르면 시작</p>
      <p class="t-ver">P1 버티컬 슬라이스 · 전투 화면은 프로토타입 임시</p>
    </div>`;
  },
});
s.el.addEventListener('click', () => { battle().sound('tick'); afterTitle(); });
