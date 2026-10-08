/**
 * 게임 그림 (28 문서). 이 폴더의 그림은 파일 이름으로 찾는다. 파일을 넣기만 하면 그 자리에 쓰이고, 없으면 대체 그림·색을 쓴다.
 * 이름: floor-<장소> 전투 진형 판 바닥, scene-<장소> 장소 풍경 (카드·입장·보스 무대), ui-<자리> 메뉴 머리 그림, boss-<이름> 보스.
 * 캐릭터(힐러·파티원·길드원) 그림은 넣지 않는다 (27 0장).
 */
const files = import.meta.glob<string>('./*.{webp,png,jpg}', { eager: true, query: '?url', import: 'default' });

const byName: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) byName[path.slice(2).replace(/\.\w+$/, '')] = url;

/** 그림 주소. 없으면 '' */
export const art = (name: string): string => byName[name] || '';
/** CSS 배경 값. 없으면 none */
export const cssUrl = (url: string): string => (url ? `url("${url}")` : 'none');

/** 모든 그림을 CSS 변수 --art-<이름> 으로 (CSS에서 var(--art-ui-guild, none) 처럼 씀) */
export function applyArtVars(root: HTMLElement = document.documentElement): void {
  for (const [name, url] of Object.entries(byName)) root.style.setProperty(`--art-${name}`, cssUrl(url));
}
