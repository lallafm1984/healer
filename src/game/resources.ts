import type { SaveData } from '../platform/storage';

/** 쓰는 재화 (91, 2026-10-16 Lim 「범용적으로 사용하기 위해서 골드 재화를 다시 넣자」): 골드 하나. 강화석 · 정제 강화석은 강화와 함께 없앰 */
export type ResourceKey = 'gold';

/** 개발 옵션은 사용 가능량만 바꾼다. 실제 잔액·보상은 유한한 값으로 보존한다. */
export const unlimitedResource = (save: SaveData, _key: ResourceKey): boolean => !!save.settings.devGold;

/** 비용 확인과 보유량 표시에 공통 사용. Infinity는 저장하지 않는다. */
export const resourceBalance = (save: SaveData, _key: ResourceKey): number =>
  unlimitedResource(save, 'gold') ? Infinity : save.player.gold;

/** 여러 재화가 필요한 작업은 모두 충분한지 확인한 뒤 차감한다. */
export function spendResource(save: SaveData, key: ResourceKey, amount: number): void {
  if (unlimitedResource(save, key)) return;
  save.player.gold -= amount;
}
