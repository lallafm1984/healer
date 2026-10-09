import { art } from '../art';
import type { ContentKey } from '../data/content';
import { CONTENT_PLACE, FACTIONS, floorArtName, sceneArtName, type FactionKey, type PlaceKey } from '../data/places';

/** 화면 장식 그림 (정식 아트 전까지 임시, 16 문서) */
export const sunSvg = `<svg viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke-linecap="round"><path d="M60 6v15M60 99v15M6 60h15M99 60h15M22 22l11 11M87 87l11 11M22 98l11-11M87 33l11-11" stroke="#0E0E15" stroke-width="12"/><path d="M60 6v15M60 99v15M6 60h15M99 60h15M22 22l11 11M87 87l11 11M22 98l11-11M87 33l11-11" stroke="#F0C46A" stroke-width="5"/></g><circle cx="60" cy="60" r="31" fill="#C9923F" stroke="#0E0E15" stroke-width="5"/><path d="M60 76c-10-6.5-16-12-16-19a8 8 0 0 1 16-3 8 8 0 0 1 16 3c0 7-6 12.5-16 19z" fill="#FFF3C8" stroke="#0E0E15" stroke-width="4" stroke-linejoin="round"/><path d="M41 48c2.5-6 7-10 13-11.5" stroke="#F6DFA0" stroke-width="4" stroke-linecap="round" fill="none"/></svg>`;

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
  key: '<circle cx="7.5" cy="12" r="3.5"/><path d="M11 12h9.5M16.5 12v3.2M19.5 12v2.6"/>',
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
  ad: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
} as const;
export type UiIconKey = keyof typeof paths;
/** extra = 'in': 글자 안에 끼우는 크기 (글자 높이에 맞춤) */
export function uiIcon(key: keyof typeof paths, extra = ''): string {
  return `<svg class="ui-icon${extra ? ` ${extra}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]}</svg>`;
}
/** 잠금 표시 (🔒 대신, 테마 색을 따름) */
export const LOCK = uiIcon('lock', 'in');

/**
 * 게임 그림 아이콘 (30·31 문서): src/art의 `<prefix>-<name>`이 있으면 그 그림, 없으면 넘겨준 선 아이콘·임시 그림.
 * 테두리(금테 원·네모 칸)는 CSS가 그림. 예: gameIcon('mission', uiIcon('quest')) → icon-mission, gameIcon('heal', 선, 'skill') → skill-heal
 */
export function gameIcon(name: string, fallback: string, prefix: 'icon' | 'tab' | 'obj' | 'ui' | 'item' | 'skill' | 'stat' | 'spec' = 'icon'): string {
  const img = art(`${prefix}-${name}`);
  return img ? `<img class="g-ic" src="${img}" alt="" decoding="async" draggable="false">` : fallback;
}

/**
 * 직업 문장 (27 5장): 힐러 그림 대신. 원형 금테 + 돌 바탕 + 선 아이콘, 색은 16 4-1 포인트 색.
 * 업데이트 직업 4종도 미리 둠 (직업 목록·상점).
 */
const EMBLEM: Record<string, { name: string; color: string; path: string }> = {
  priest: { name: '사제 문장 · 햇살 성표', color: '#F6E7B8', path: '<circle cx="12" cy="12" r="5.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"/><path d="M12 14.4c-1.7-1.1-2.7-2-2.7-3.2a1.35 1.35 0 0 1 2.7-.5 1.35 1.35 0 0 1 2.7.5c0 1.2-1 2.1-2.7 3.2z"/>' },
  druid: { name: '드루이드 문장 · 뿔 지팡이와 잎', color: '#9BD66A', path: '<path d="M12 21V10"/><path d="M12 10C11 7.5 9 6 6.5 6M12 10c1-2.5 3-4 5.5-4M7.5 6V3.5M16.5 6V3.5"/><path d="M12 15.5c2.6 0 4.6-1.6 5.2-4.2-2.6 0-4.6 1.6-5.2 4.2z"/>' },
  paladin: { name: '성기사 문장 · 둥근 방패', color: '#F0A848', path: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3.5v6M12 14.5v6M3.5 12h6M14.5 12h6"/>' },
  shaman: { name: '주술사 문장 · 토템', color: '#7EC8F0', path: '<path d="M8 3h8v6H8zM9 9h6v6H9zM8 15h8v6H8z"/><path d="M5 12h4M15 12h4"/>' },
  monk: { name: '수도사 문장 · 찻주전자', color: '#6FD0B0', path: '<path d="M6 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2 2 0 0 1 0 4H17"/><path d="M6 12L3.5 9.5"/><path d="M10 7h3M11.5 5v2"/>' },
  astrologer: { name: '점성술사 문장 · 망원경과 별', color: '#D19A5E', path: '<path d="M4 15l11-6 2 3.5-11 6z"/><path d="M9 17l-2 4M11 16l2 5"/><path d="M19 2.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z"/>' },
  warder: { name: '결계사 문장 · 빛나는 방패', color: '#E6D3A0', path: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M12 8l3 3-3 3-3-3z"/>' },
};
export const emblemColor = (hero: string): string => (EMBLEM[hero] || EMBLEM.priest).color;
/** size: 아이콘 크기 클래스 (sm 24 · md 40 · lg 64 · xl 96) */
export function classEmblem(hero: string, size: 'sm' | 'md' | 'lg' | 'xl' = 'md'): string {
  const e = EMBLEM[hero] || EMBLEM.priest, img = art(`emblem-${hero}`);
  // 그린 문장(emblem-<직업>)이 있으면 그 그림, 없으면 선 아이콘 (28 7장)
  const inner = img ? `<img src="${img}" alt="" decoding="async" draggable="false">` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${e.path}</svg>`;
  return `<span class="emblem emblem-${size}${hero === 'warder' ? ' dark' : ''}" style="--em:${e.color}" role="img" aria-label="${e.name}">${inner}</span>`;
}

/** 세력 문양 (27 3-1): 골렘 톱니 · 역병 플라스크 · 늪 잎 · 귀족가 백합 · 마도사 눈꽃 · 해바라기 언덕 해바라기 · 심연 소용돌이 눈 (10 4장) */
const FACTION_PATH: Record<FactionKey, string> = {
  golem: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>',
  plague: '<path d="M9.5 3h5M10 3v5.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9.5V3"/><path d="M7.5 15h9"/><circle cx="10.5" cy="17.5" r=".6"/><circle cx="13.5" cy="18.5" r=".6"/>',
  swamp: '<path d="M5 19C-1 8 10 3 21 3c0 11-5 20-16 16Z"/><path d="M5 19l10-10"/>',
  noble: '<path d="M12 21v-7"/><path d="M12 14c-1.5-2.5-1.5-6 0-10 1.5 4 1.5 7.5 0 10z"/><path d="M12 14c-2-1-5-1.5-7.5-5 3.5-.5 6 1.5 7.5 5zM12 14c2-1 5-1.5 7.5-5-3.5-.5-6 1.5-7.5 5z"/><path d="M8.5 21h7"/>',
  mage: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="M10 4.5l2 2 2-2M10 19.5l2-2 2 2M4.6 10l2.7.8-.7 2.7M19.4 14l-2.7-.8.7-2.7"/>',
  hill: '<circle cx="12" cy="9" r="2.4"/><ellipse cx="12" cy="4.4" rx="1.4" ry="2.2" transform="rotate(0 12 9)"/><ellipse cx="12" cy="4.4" rx="1.4" ry="2.2" transform="rotate(45 12 9)"/><ellipse cx="12" cy="4.4" rx="1.4" ry="2.2" transform="rotate(90 12 9)"/><ellipse cx="12" cy="4.4" rx="1.4" ry="2.2" transform="rotate(135 12 9)"/><ellipse cx="12" cy="4.4" rx="1.4" ry="2.2" transform="rotate(180 12 9)"/><ellipse cx="12" cy="4.4" rx="1.4" ry="2.2" transform="rotate(225 12 9)"/><ellipse cx="12" cy="4.4" rx="1.4" ry="2.2" transform="rotate(270 12 9)"/><ellipse cx="12" cy="4.4" rx="1.4" ry="2.2" transform="rotate(315 12 9)"/><path d="M12 13.6V21.5M12 18.5c1.4-1.7 3-2.3 4.8-2.1"/>',
  abyss: '<path d="M2.5 12C5 7.6 8.3 5.5 12 5.5s7 2.1 9.5 6.5c-2.5 4.4-5.8 6.5-9.5 6.5S5 16.4 2.5 12z"/><path d="M12 9a3 3 0 1 1-3 3c0-1.1.9-1.9 1.9-1.9s1.5.7 1.5 1.4"/>',
};
export function factionMark(f: FactionKey, size: 'sm' | 'md' | 'lg' = 'md'): string {
  const img = art(`mark-${f}`);
  const inner = img ? `<img src="${img}" alt="" decoding="async" draggable="false">` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FACTION_PATH[f]}</svg>`;
  return `<span class="fmark fmark-${size}" style="--fc:${FACTIONS[f].color}" role="img" aria-label="${FACTIONS[f].name} 문양">${inner}</span>`;
}

/** 장소 그림: 풍경이 있으면 풍경, 없으면 바닥 그림 (28 4장) */
export function placeArt(c: ContentKey): { url: string; scene: boolean; place: PlaceKey } {
  const place = CONTENT_PLACE[c];
  const scene = art(sceneArtName(place));
  return { url: scene || art(floorArtName(place)), scene: !!scene, place };
}

// 재화 그림: 그림(icon-<이름>)이 오면 그 그림, 없으면 임시 그림 (33 그림 요청)
const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const CURRENCY_ART = {
  gold: svg('<circle cx="12" cy="12" r="8" fill="#E8B23A" stroke="#7A5418" stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="#B9831F" stroke-width="1.6"/>'),
  crystal: svg('<path d="M6 4h12l3 5-9 11L3 9z" fill="#7FC8FF" stroke="#1E4A7A" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 9h18M9 4l3 16 3-16" fill="none" stroke="#1E4A7A" stroke-width="1.2"/>'),
  stone: svg('<path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z" fill="#8C8577" stroke="#3B352C" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" stroke="#5E574B" stroke-width="1"/>'),
  refined: svg('<path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z" fill="#BFE3F2" stroke="#2F5568" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" stroke="#7FAFC4" stroke-width="1"/>'),
  merit: svg('<path d="M8 2h8l-2 7h-4z" fill="#B23A2E" stroke="#4A1712" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="15" r="6" fill="#D9A441" stroke="#6B4A14" stroke-width="1.6"/><path d="M12 11.5l1 2.2 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="#FFF0C2"/>'),
};
export type CurrencyIconKey = keyof typeof CURRENCY_ART;
/** 모든 메뉴가 같은 재화 그림과 SVG 대체 그림을 공유한다. */
export function currencyIcon(key: CurrencyIconKey): string {
  return `<span class="currency-icon" aria-hidden="true">${gameIcon(key, CURRENCY_ART[key])}</span>`;
}
