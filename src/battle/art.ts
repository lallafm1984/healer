/** 전투 화면 임시 그림 (보스·소비 아이템). 정식 그림이 나오면 리소스로 바꿈 (22 리소스 목록) */
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
  plague: '💡 역병 군주의 독침은 사제가 못 지움. 해제 두루마리로는 지울 수 있음',
};

// 보스 그림 (임시)
export function bossSvg(script: string): string {
  if (script === 'warden' || script === 'scrap' || script === 'trash') return `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="#0E0E15" stroke-width="4" stroke-linejoin="round"><rect x="6" y="46" width="16" height="34" rx="6" fill="#7E4426"/><rect x="78" y="46" width="16" height="34" rx="6" fill="#7E4426"/><rect x="14" y="40" width="72" height="52" rx="10" fill="#9C5A33"/><rect x="28" y="10" width="44" height="34" rx="8" fill="#B5683A"/><path d="M40 60h20v16H40z" fill="#6E3A20" stroke-width="3"/></g><rect x="35" y="22" width="11" height="7" rx="2" fill="#FFB347"/><rect x="54" y="22" width="11" height="7" rx="2" fill="#FFB347"/><g fill="#5E321C"><circle cx="25" cy="52" r="3"/><circle cx="75" cy="52" r="3"/><circle cx="25" cy="82" r="3"/><circle cx="75" cy="82" r="3"/></g></svg>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M84 22V94" stroke="#0E0E15" stroke-width="9"/><path d="M84 22V94" stroke="#5B3B22" stroke-width="4"/><g stroke="#0E0E15" stroke-width="4" stroke-linejoin="round"><path d="M50 8C28 10 22 34 22 52L14 94H80L76 52C76 34 72 10 50 8Z" fill="#6E7233"/><path d="M50 20C38 22 34 34 34 48C40 56 60 56 66 48C66 34 62 22 50 20Z" fill="#1C1B14"/></g><circle cx="84" cy="18" r="7" fill="#C8E06A" stroke="#0E0E15" stroke-width="3"/><circle cx="43" cy="40" r="3.5" fill="#C8E06A"/><circle cx="57" cy="40" r="3.5" fill="#C8E06A"/><path d="M30 72Q50 65 70 72" stroke="#4E5124" stroke-width="4" fill="none"/></svg>`;
}
