/** 화면 장식 그림 (정식 아트 전까지 임시, 16 문서) */
export const bellSvg = `<svg viewBox="0 0 120 120" aria-hidden="true"><g stroke="#0E0E15" stroke-width="5" stroke-linejoin="round"><path d="M60 14c-6 0-9 4-9 8v4C34 30 28 46 28 62v18l-10 12h84l-10-12V62c0-16-6-32-23-36v-4c0-4-3-8-9-8z" fill="#C9923F"/><path d="M60 26l-6 18 8 10-5 16" fill="none" stroke-width="4"/><circle cx="60" cy="100" r="9" fill="#F0C46A"/></g><path d="M40 62c0-10 4-18 12-22" stroke="#F6DFA0" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`;

/** 작은 메뉴 기호는 기존 SVG처럼 벡터로 유지. 그림 자산과 역할을 분리한다. */
const paths = {
  battle: '<path d="m12 3 7 3v6c0 5-7 9-7 9s-7-4-7-9V6z"/><path d="M12 7v9m-4-5h8"/>',
  char: '<path d="m8 3 8 0 2 5-6 3-6-3zM8 11l-4 9h16l-4-9M12 11v9"/>',
  guild: '<path d="M6 21V3h12l-2 4 2 4H6M3 21h6"/><path d="m10 6 2 2 2-2"/>',
  shop: '<path d="M5 9h14l1 12H4zM8 9V6a4 4 0 0 1 8 0v3"/>',
  quest: '<path d="M8 4H5v17h14V4h-3M8 2h8v5H8zM8 12h8M8 16h5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  gem: '<path d="m3 8 4-5h10l4 5-9 13zM3 8h18M7 3l5 18 5-18"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4 5-4 5-4-5z"/>',
  bell: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 20h4M12 2v2"/>',
  star: '<path d="m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1z"/>',
  leaf: '<path d="M5 19C-1 8 10 3 21 3c0 11-5 20-16 16ZM5 19l10-10"/>',
  // 장비 부위 (캐릭터 장비 칸)
  weapon: '<path d="M6 21 15.5 8"/><circle cx="17" cy="6" r="3"/>',
  head: '<path d="M5 19c0-8 3-14 7-14s7 6 7 14z"/><path d="M9 19c0-4 1.5-7 3-7s3 3 3 7"/>',
  chest: '<path d="M9 3h6l2 4 2 14H5L7 7z"/><path d="M12 7v14"/>',
  hands: '<path d="M7 21v-9a1.5 1.5 0 0 1 3 0V5a1.5 1.5 0 0 1 3 0v6V4.5a1.5 1.5 0 0 1 3 0V12V8a1.5 1.5 0 0 1 3 0v7c0 3.5-2.5 6-6 6z"/>',
  ring: '<circle cx="12" cy="14.5" r="6"/><path d="m9 5.5 3-2.5 3 2.5-3 2.5z"/>',
  neck: '<path d="M5 3c0 7 3 11 7 11s7-4 7-11"/><path d="m12 14-2.5 3 2.5 3.5 2.5-3.5z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  hourglass: '<path d="M7 3h10M7 21h10M8 3v2c0 3 4 5 4 7s-4 4-4 7v2M16 3v2c0 3-4 5-4 7s4 4 4 7v2"/>',
} as const;
export type UiIconKey = keyof typeof paths;
/** extra = 'in': 글자 안에 끼우는 크기 (글자 높이에 맞춤) */
export function uiIcon(key: keyof typeof paths, extra = ''): string {
  return `<svg class="ui-icon${extra ? ` ${extra}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
}
/** 잠금 표시 (🔒 대신, 테마 색을 따름) */
export const LOCK = uiIcon('lock', 'in');

export function healerArt(hero: string): string {
  const names: Record<string, string> = { priest: '종 지팡이를 든 사제', druid: '잎 지팡이를 든 드루이드', paladin: '방패와 등불을 든 성기사' };
  if (names[hero]) return `<img class="healer-illustration" src="/art/healer-${hero}-v1.webp" alt="${names[hero]}" width="1254" height="1254" draggable="false">`;
  return `<span class="hero-sigil hero-sigil-${hero}">${uiIcon(hero === 'druid' ? 'leaf' : 'battle')}</span>`;
}

/** 장소가 다른 콘텐츠에는 요새 이미지를 재사용하지 않는다. */
export function destinationArt(key: string): string {
  return key === 'rustfort' ? '/art/rustfort-v1.webp' : '';
}
