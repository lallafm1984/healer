/** 전투 아트. 녹슨 계열은 생성 원화, 다른 보스·소비 아이템은 기존 벡터 그림. */
import { art } from '../art';
import type { ItemKey } from '../data/items';

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

// 기존 호출 API를 유지하며 준비된 계열부터 일러스트를 사용한다.
export function bossSvg(script: string): string {
  if (script === 'warden' || script === 'scrap' || script === 'trash') return `<img class="boss-illustration" src="${art('boss-rust-guardian')}" alt="" decoding="async" draggable="false">`;
  // 무음 성가대: 지휘봉을 든 지휘자 (정식 그림은 22 리소스 목록에서)
  if (script === 'choir') return `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="#0E0E15" stroke-width="4" stroke-linejoin="round"><path d="M50 30C34 32 28 52 26 94H74C72 52 66 32 50 30Z" fill="#3B3F6B"/><circle cx="50" cy="22" r="13" fill="#C9C3B0"/><path d="M38 62L60 50" fill="none"/></g><path d="M62 49L88 22" stroke="#0E0E15" stroke-width="5" stroke-linecap="round"/><path d="M62 49L88 22" stroke="#F0C46A" stroke-width="2.5" stroke-linecap="round"/><path d="M43 23h4M53 23h4" stroke="#0E0E15" stroke-width="3" stroke-linecap="round"/><path d="M45 31h10" stroke="#0E0E15" stroke-width="3" stroke-linecap="round"/><path d="M36 70h28M34 82h32" stroke="#2A2D52" stroke-width="3"/></svg>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M84 22V94" stroke="#0E0E15" stroke-width="9"/><path d="M84 22V94" stroke="#5B3B22" stroke-width="4"/><g stroke="#0E0E15" stroke-width="4" stroke-linejoin="round"><path d="M50 8C28 10 22 34 22 52L14 94H80L76 52C76 34 72 10 50 8Z" fill="#6E7233"/><path d="M50 20C38 22 34 34 34 48C40 56 60 56 66 48C66 34 62 22 50 20Z" fill="#1C1B14"/></g><circle cx="84" cy="18" r="7" fill="#C8E06A" stroke="#0E0E15" stroke-width="3"/><circle cx="43" cy="40" r="3.5" fill="#C8E06A"/><circle cx="57" cy="40" r="3.5" fill="#C8E06A"/><path d="M30 72Q50 65 70 72" stroke="#4E5124" stroke-width="4" fill="none"/></svg>`;
}
