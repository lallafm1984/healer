/**
 * 메뉴 소리 (107 2장 · 5장): 누를 때마다 한 번. 탭 = ui-tab, 스위치 · 칩 · 고르기 = ui-toggle, 노란 주요 버튼 = ui-confirm, 잠긴 것 = deny, 그 밖 = ui-tap.
 * 그 누름에서 화면이 이미 다른 소리 (장착 · 판매 · 시트 열림 …)를 냈으면 안 냄 (창 맨 끝에서 들음).
 * data-sfx="이름"이면 그 소리, "none"이면 소리 없음. 전투 판 · 휠은 전투 소리만 (일시정지 창은 메뉴처럼)
 */
import { qualityOf, type GearItem } from '../data/equipment';
import { sfx, sfxRecent } from '../sfx';

const PRESS = 'button, a[href], [role="button"], [role="tab"], [role="radio"], [role="switch"], label, summary, input, select, [data-sfx]';
const TAB = '[data-tab], [data-csub], [role="tab"]';
const TOGGLE = 'input[type="checkbox"], input[type="radio"], label, .chip, [role="radio"], [role="switch"], [aria-pressed]';

export function mountUiSounds(): void {
  window.addEventListener('click', e => {
    if (sfxRecent()) return;
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>(PRESS) : null;
    if (!el) return;
    const own = el.closest<HTMLElement>('[data-sfx]')?.dataset.sfx;
    if (own) { if (own !== 'none') sfx(own); return; }
    if (el.closest('#battle') && !el.closest('#pause, #pauseBtn, .overlay')) return;
    if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') { sfx('deny'); return; }
    sfx(el.matches(TAB) ? 'ui-tab' : el.matches(TOGGLE) ? 'ui-toggle' : el.matches('.primary') ? 'ui-confirm' : 'ui-tap');
  });
}

/** 장비 카드 소리 (결과 · 행상인 감정): 전설 = 빛기둥, 희귀 · 영웅 · 정교한 · 완벽한 = 반짝, 그 밖 = 툭 */
export const lootSound = (it: GearItem): string =>
  it.grade === '전설' ? 'loot-legend' : it.grade === '영웅' || it.grade === '희귀' || qualityOf(it) ? 'loot-rare' : 'loot';
