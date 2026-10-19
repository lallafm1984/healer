/** 작은 파티원 지표: 같은 윤곽을 쓰는 금빛 별. */
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
