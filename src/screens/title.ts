/** S01 타이틀 (09). 게임 이름은 아직 가제 (21 6장) */
import { battle, go, screen } from './kit';

const BELL = `<svg viewBox="0 0 120 120" aria-hidden="true"><g stroke="#0E0E15" stroke-width="5" stroke-linejoin="round"><path d="M60 14c-6 0-9 4-9 8v4C34 30 28 46 28 62v18l-10 12h84l-10-12V62c0-16-6-32-23-36v-4c0-4-3-8-9-8z" fill="#C9923F"/><path d="M60 26l-6 18 8 10-5 16" fill="none" stroke-width="4"/><circle cx="60" cy="100" r="9" fill="#F0C46A"/></g><path d="M40 62c0-10 4-18 12-22" stroke="#F6DFA0" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`;
export const bellSvg = BELL;

const s = screen('s-title', '타이틀', {
  enter() {
    s.el.innerHTML = `<div class="t-wrap">
      <div class="t-emblem">${BELL}</div>
      <h1 class="t-name">나혼자 힐러</h1>
      <p class="t-sub">가제 · 개발 빌드</p>
      <p class="t-tap">화면을 누르면 시작</p>
      <p class="t-ver">P1 버티컬 슬라이스 · 전투 화면은 프로토타입 임시</p>
    </div>`;
  },
});
s.el.addEventListener('click', () => { battle().sound('tick'); go('s-lobby'); });
