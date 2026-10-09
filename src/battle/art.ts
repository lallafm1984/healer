/** 전투 아트. 보스·잡몹은 생성 원화(src/art의 boss-·mob-, 29 문서), 없으면 벡터 그림. 소비 아이템은 벡터 그림. */
import { art } from '../art';
import type { ItemKey } from '../data/items';
import { SKILLS, type SkillKey, type SlotName } from '../data/skills';

/** 작은 스킬 칸에서도 구분되는 기능 문양. 원화·직업 색에 의존하지 않는 공통 실루엣. */
const SKILL_MARK: Record<SlotName, string> = {
  basic: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  fast: '<path d="M14 2L4 14h7l-1 8 10-13h-7z"/>',
  hot: '<path d="M5 19C1 9 9 3 20 3c1 11-5 19-15 16zM5 19L16 8M8 15v-4M11 12h5"/>',
  aoe: '<circle cx="12" cy="5" r="3"/><circle cx="5" cy="16" r="3"/><circle cx="19" cy="16" r="3"/><path d="M10 8L7 13m7-5 3 5M8 16h8"/>',
  dispel: '<path d="M12 2C8 8 5 11 5 15a7 7 0 0 0 14 0c0-4-3-7-7-13zM7 19L17 9"/>',
  ext: '<path d="M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5zM8 12l3 3 5-6"/>',
  raid: '<path d="M9 17V5l11-3v13M9 7l11-3"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
  unique: '<path d="M12 3v15M7 8l5-5 5 5M4 15v6h16v-6"/>',
};
export function skillMark(key: SkillKey): string {
  const path = key === 'handGuard' ? '<path d="M7 12V6a1.5 1.5 0 0 1 3 0v5-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7-3 0-5-2-6-4L3 13a1.5 1.5 0 0 1 2-2z"/>' : SKILL_MARK[SKILLS[key].slot];
  return `<svg class="skill-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const potion = (c: string) => `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12.5 6h7v4.2a9 9 0 1 1-7 0z" fill="${c}" stroke="#0B0B12" stroke-width="2" stroke-linejoin="round"/><rect x="11.5" y="3" width="9" height="4" rx="1.2" fill="#C9923F" stroke="#0B0B12" stroke-width="1.6"/><ellipse cx="12.8" cy="20" rx="1.8" ry="3" fill="rgba(255,255,255,.5)"/></svg>`;
const scroll = (mark: string) => `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="7" width="18" height="18" rx="2" fill="#E9DDBC" stroke="#0B0B12" stroke-width="2"/><rect x="5" y="4" width="22" height="5" rx="2.5" fill="#B98F4E" stroke="#0B0B12" stroke-width="1.8"/><rect x="5" y="23" width="22" height="5" rx="2.5" fill="#B98F4E" stroke="#0B0B12" stroke-width="1.8"/>${mark}</svg>`;
export const ITEM_ICON: Record<ItemKey, string> = {
  mana: potion('#4C8FE0'),
  medit: potion('#51C6C0'),
  life: potion('#D9342B'),
  cleanse: scroll('<path d="M16 11.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#2E9A94" stroke="#0B0B12" stroke-width="1"/>'),
  shield: scroll('<path d="M16 11l5 1.8v3.4c0 3-2.2 4.8-5 5.8-2.8-1-5-2.8-5-5.8v-3.4z" fill="#F0C46A" stroke="#0B0B12" stroke-width="1.4"/>'),
  feather: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M25 4C15 6 9 13 8.5 24l2.2 1.6c3-1.2 5.2-3.8 6.3-7l3.8-.8-2.9-1.2 4.6-3.9-3.8.2C21.6 10.3 23.8 7.4 25 4z" fill="#F6F0E0" stroke="#0B0B12" stroke-width="1.8" stroke-linejoin="round"/><path d="M21 9L6 28" stroke="#C9923F" stroke-width="1.8" stroke-linecap="round"/></svg>`,
};
// 보스 궁합 힌트 (19 9장 등록)
export const ITEM_HINT: Record<string, string> = {
  warden: '💡 녹슨 문지기는 탱커 강타가 셈. 보호 두루마리를 강타 직전 탱커에게 걸면 버티기 쉬움',
  plague: '💡 역병 군주의 독침은 사제가 못 지움 (드루이드·성기사는 지움). 해제 두루마리로도 지울 수 있음',
  choir: '💡 무음 성가대의 독창은 3명이라 해제가 모자람. 해제 두루마리 한 장이면 한 번에 지움',
};

/**
 * 보스 무대 원형 초상·공략 그림 이름 (29 4장). 전투(구간)마다 앞에서부터 있는 그림을 쓴다.
 * boss-<이름> = 그 보스, mob-<이름> = 그 잡몹 구간. 하나도 없으면 아래 벡터 그림.
 */
const ENC_ART: Record<string, string[]> = {
  warden: ['boss-rust-guardian'],
  scrap: ['boss-scrap-guard', 'boss-rust-guardian'],
  patrol: ['boss-scrap-guard', 'boss-rust-guardian'],
  gate: ['mob-scrap-minion', 'mob-debris-thrower', 'boss-rust-guardian'],
  boiler: ['mob-boiler-golem', 'boss-rust-guardian'],
  field: ['mob-scrap-minion', 'mob-debris-thrower', 'boss-rust-guardian'],
  duo: ['mob-scrap-minion', 'boss-rust-guardian'],
  trash: ['mob-scrap-minion', 'boss-rust-guardian'],
  plague: ['boss-plague-lord'],
  choir: ['boss-silent-choir'],
};
/** 그 전투에 쓸 그림 주소 (없으면 '') */
export function encArt(key: string, script = key): string {
  const name = (ENC_ART[key] || ENC_ART[script] || []).find(n => art(n));
  return name ? art(name) : '';
}
/** 역병 군주 인터미션 쥐떼 (보스 무대 작은 그림, 없으면 '') */
export const ratsArt = (): string => art('mob-crypt-rats');

export function bossSvg(script: string, key = script): string {
  const src = encArt(key, script);
  if (src) return `<img class="boss-illustration" src="${src}" alt="" decoding="async" draggable="false">`;
  // 무음 성가대: 지휘봉을 든 지휘자 (정식 그림은 22 리소스 목록에서)
  if (script === 'choir') return `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="#0E0E15" stroke-width="4" stroke-linejoin="round"><path d="M50 30C34 32 28 52 26 94H74C72 52 66 32 50 30Z" fill="#3B3F6B"/><circle cx="50" cy="22" r="13" fill="#C9C3B0"/><path d="M38 62L60 50" fill="none"/></g><path d="M62 49L88 22" stroke="#0E0E15" stroke-width="5" stroke-linecap="round"/><path d="M62 49L88 22" stroke="#F0C46A" stroke-width="2.5" stroke-linecap="round"/><path d="M43 23h4M53 23h4" stroke="#0E0E15" stroke-width="3" stroke-linecap="round"/><path d="M45 31h10" stroke="#0E0E15" stroke-width="3" stroke-linecap="round"/><path d="M36 70h28M34 82h32" stroke="#2A2D52" stroke-width="3"/></svg>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M84 22V94" stroke="#0E0E15" stroke-width="9"/><path d="M84 22V94" stroke="#5B3B22" stroke-width="4"/><g stroke="#0E0E15" stroke-width="4" stroke-linejoin="round"><path d="M50 8C28 10 22 34 22 52L14 94H80L76 52C76 34 72 10 50 8Z" fill="#6E7233"/><path d="M50 20C38 22 34 34 34 48C40 56 60 56 66 48C66 34 62 22 50 20Z" fill="#1C1B14"/></g><circle cx="84" cy="18" r="7" fill="#C8E06A" stroke="#0E0E15" stroke-width="3"/><circle cx="43" cy="40" r="3.5" fill="#C8E06A"/><circle cx="57" cy="40" r="3.5" fill="#C8E06A"/><path d="M30 72Q50 65 70 72" stroke="#4E5124" stroke-width="4" fill="none"/></svg>`;
}

/**
 * 진형 판 「나」 칸의 직업 문장 (27 3-4·5장: ✚ 대신 직업 문장, 원형 금테 + 돌 바탕).
 * 그린 문장(emblem-<직업>)이 있으면 그 그림, 없으면 선 아이콘 (src/screens/art.ts의 EMBLEM 모양·색과 같음).
 * 돌려주는 값 = 판에서 그림으로 쓸 SVG·그림 주소 (board.ts가 캔버스에 그려 텍스처로 씀)
 */
const EMBLEM_LINE: Record<string, string> = {
  priest: '<path d="M6.5 16v-4.5a5.5 5.5 0 0 1 11 0V16l1.5 2h-14z"/><path d="M12 4v2"/><path d="M12.6 9.4l-1.4 2.4 1.8 1.4-1 2.3"/><path d="M10 20.5h4"/>',
  druid: '<path d="M12 21V10"/><path d="M12 10C11 7.5 9 6 6.5 6M12 10c1-2.5 3-4 5.5-4M7.5 6V3.5M16.5 6V3.5"/><path d="M12 15.5c2.6 0 4.6-1.6 5.2-4.2-2.6 0-4.6 1.6-5.2 4.2z"/>',
  paladin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3.5v6M12 14.5v6M3.5 12h6M14.5 12h6"/>',
};
export function emblemSrc(hero: string, color: string): { src: string; painted: boolean } {
  const img = art(`emblem-${hero}`);
  if (img) return { src: img, painted: true };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${EMBLEM_LINE[hero] || EMBLEM_LINE.priest}</svg>`;
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, painted: false };
}
