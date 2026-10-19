/** 작은 파티원 지표: 같은 윤곽을 쓰는 금빛 별과 황동 테 인연 하트. */
const STAR = 'M12 2.3 15 8.5 21.8 9.5 16.9 14.3 18.1 21 12 17.8 5.9 21 7.1 14.3 2.2 9.5 9 8.5Z';

/** 반 별은 왼쪽 절반만 채운다. 글꼴이나 기기의 별 문자 모양에 의존하지 않는다. */
export function ratingStarsHtml(value: number): string {
  const n = Number.isFinite(value) ? Math.max(0, Math.min(5, Math.round(value * 2) / 2)) : 0;
  const stars = Array.from({ length: Math.ceil(n) }, (_, i) => {
    const half = n - i < 1;
    return `<svg class="rating-star${half ? ' half' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR}" fill="#392e20"/>
      <svg width="${half ? 12 : 24}" height="24" viewBox="0 0 ${half ? 12 : 24} 24" overflow="hidden"><path d="${STAR}" fill="#e2b85c"/><path d="M12 2.3 12 12 2.2 9.5 9 8.5Z" fill="#fff0b0"/><path d="M12 12 18.1 21 12 17.8 5.9 21Z" fill="#bd873b"/></svg>
      <path d="${STAR}" fill="none" stroke="#b89b61" stroke-width="1.1" stroke-linejoin="round"/></svg>`;
  }).join('');
  return `<span class="ability-stars" role="img" aria-label="별 ${n} / 5">${stars}</span>`;
}

/** 아는 사이는 윤곽, 친구·길드원은 차분한 적동색, 단짝은 금빛. */
export function bondIconSvg(lv: number): string {
  const filled = lv >= 2, gold = lv >= 12;
  return `<svg class="bond-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M12 20.3 3.9 12.5C-1 7.5 5.7.7 10.5 5.7L12 7.3l1.5-1.6c4.8-5 11.5 1.8 6.6 6.8Z" fill="${filled ? gold ? '#d0a24d' : '#a86450' : '#342b24'}" stroke="${gold ? '#ead08b' : '#be9b72'}" stroke-width="1.5" stroke-linejoin="round"/>${filled ? '<path d="M5.2 8.6c0-1.9 2-2.6 3.5-1.7" stroke="#f3d2ac" stroke-opacity=".7" stroke-width="1.5" stroke-linecap="round"/>' : ''}</svg>`;
}
