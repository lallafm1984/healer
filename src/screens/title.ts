/** S01 타이틀: 게임 이름 · 하단 시작 버튼. 시작 입력은 버튼만 받는다. */
import './title.css';
import { t, tc } from '../i18n';
import './title-motion.css';
import { G } from '../game/state';
import { battle, screen } from './kit';
import { afterTitle } from './tutorial';
import { prepareTitleBloom, titleBloom } from './transition';
import { sfx } from '../sfx';
import { serverReady } from '../platform/startup';

let stopMotion = () => {};
const glyphs = (word: string, from = 0): string => [...word].map((glyph, i) =>
  `<span class="t-letter" data-glyph="${glyph}" style="--letter:${from + i}">${glyph}</span>`).join('');
const motes = [
  [10, 73, -14, 11], [84, 62, 16, 13], [21, 87, 22, 15],
  [74, 81, -18, 12], [7, 46, 17, 13], [80, 28, -12, 16],
];

const s = screen('s-title', '타이틀', {
  enter() {
    stopMotion();
    prepareTitleBloom();
    s.el.innerHTML = `<div class="t-atmosphere" aria-hidden="true"><i class="t-dawn"></i>${motes.map(([x, y, drift, duration], i) =>
      `<i class="t-mote" style="--x:${x}%;--y:${y}%;--drift:${drift}px;--duration:${duration}s;--delay:${-i * 1.37}s;--size:${8 + i % 3 * 3}px"></i>`).join('')}</div>
    <div class="t-wrap">
      <div class="t-brand">
        <div class="t-plate-fx" aria-hidden="true"><i class="t-sheen"><i></i></i><i class="t-glint"></i></div>
        <h1 class="t-name" aria-label="${tc('나혼자 힐러', 'title')}"><span class="t-prefix" aria-hidden="true">${glyphs(tc('나혼자', 'title'))}</span> <span class="t-main" aria-hidden="true">${glyphs(tc('힐러', 'title'), [...tc('나혼자', 'title')].length)}</span></h1>
      </div>
    </div><button type="button" id="titleStart"><span class="t-start-label">${t('시작하기')}</span></button>`;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      const automated = navigator.webdriver && !(window as unknown as { __screenFx?: boolean }).__screenFx;
      s.el.classList.toggle('t-calm', !!G.save.settings.reducedEffects || reduce.matches || automated);
      s.el.classList.toggle('t-paused', document.hidden);
    };
    sync();
    s.el.classList.add('t-live');
    reduce.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    stopMotion = () => {
      reduce.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      s.el.classList.remove('t-live', 't-paused');
    };
  },
  leave() { stopMotion(); },
});
/** 타이틀 금빛이 덮는 동안 다시 눌러도 한 번만 (2026-10-24 화면 전환 A안) */
let leaving = false;
s.el.addEventListener('click', event => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>('#titleStart');
  if (!button || leaving || !serverReady()) return;
  leaving = true;
  button.disabled = true;
  if (!sfx('title-start')) battle().sound('tick');
  titleBloom(s.el.querySelector('.t-name'), () => { leaving = false; afterTitle(); });
});
